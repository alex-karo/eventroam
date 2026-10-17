import { shrinkText, type ResearchLogger } from "../../runtime/logging";
import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import type {
  CatalogResearchInput,
  ResearchDependencies,
} from "../../contracts";
import type { ResearchBudget } from "../../runtime/budget";
import type { ResearchConfig } from "../../runtime/config";
import {
  createResearchModel,
  MAX_PROVIDER_UNAVAILABLE_RETRIES,
  providerUnavailableRetry,
  researchProviderOptions,
} from "../../runtime/openrouter";
import { traceFailure } from "../../runtime/tracing";
import type { RunObservability } from "../../runtime/observability/runtime";
import type { SourceSession } from "../../tools/session";
import type { ResearchError } from "../contracts";
import { modelOutputSchema, normalizeWireCandidate } from "./wire";
import { promptFor } from "./input";
import { researchSystemInstructions } from "./prompt";
import type { ResearchContext } from "../context";
import { classifyModelError } from "../../runtime/model-errors";
import { createResearchTools } from "../../tools/index";
import type { ToolOutputCapture } from "../../tool-output-capture";
import { completedStepUsage, updateModelUsage, type ModelUsage } from "./usage";

export type { ModelUsage } from "./usage";

export type ResearchExecution = {
  usage: ModelUsage;
  modelResponse?: { text: string | null; object: unknown } | null;
} & ({ ok: true; candidate: unknown } | { ok: false; errors: ResearchError[] });

export async function researchFestival(
  input: CatalogResearchInput,
  context: ResearchContext,
  sources: SourceSession,
  budget: ResearchBudget,
  config: ResearchConfig,
  deps: Pick<ResearchDependencies, "generateCandidate" | "todayUtc">,
  tracing?: RunObservability,
  abortSignal?: AbortSignal,
  capture?: ToolOutputCapture,
): Promise<ResearchExecution> {
  const { catalog, terms, knownLinks } = context;
  const { reads, readPage: read, searchWeb: search } = sources;
  let providerError: unknown;
  const log = tracing?.log;
  let stepNumber = 0;
  let attemptNumber = 0;
  let unavailableAttempts = 0;
  const modelContext = () => ({
    stage: "research",
    step: stepNumber,
    attempt: attemptNumber,
  });
  let modelLog = log?.child(modelContext());
  const tools = createResearchTools(
    sources,
    budget,
    modelContext,
    tracing,
    abortSignal,
    capture,
  );
  const usage: ModelUsage = {
    complete: !deps.generateCandidate,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: deps.generateCandidate ? null : 0,
    reasoningTokens: deps.generateCandidate ? null : 0,
    modelCostUsd: null,
  };
  let completedSteps = 0;
  let startedSteps = 0;
  const agent = deps.generateCandidate
    ? null
    : new Agent({
        id: "festival-research",
        name: "Festival research",
        instructions: researchSystemInstructions,
        model: createResearchModel(config),
        // Mastra's default error processors can retry independently of maxRetries.
        errorProcessorDefaults: false,
        maxProcessorRetries: MAX_PROVIDER_UNAVAILABLE_RETRIES,
        errorProcessors: [
          providerUnavailableRetry(
            budget,
            () => {
              unavailableAttempts += 1;
              startedSteps -= 1;
              usage.complete = false;
            },
            log,
          ),
        ],
        tools,
      });
  if (budget.limits.agentSteps <= 0) {
    modelLog?.warn("Research budget exhausted", {
      budgetKind: "agentSteps",
      limit: budget.limits.agentSteps,
    });
    return {
      ok: false,
      usage,
      errors: [
        {
          code: "limit_reached",
          stage: "research",
          message: "Agent step limit reached",
        },
      ],
    };
  }
  const prompt = promptFor(
    input,
    catalog,
    knownLinks,
    terms,
    budget.remaining(),
    reads,
    context.currentDate,
    (inspectedSources) => {
      for (const source of inspectedSources) {
        capture?.save(capture.reserve(), "initial-source", source);
      }
    },
  );
  let raw: unknown;
  let text: string | null = null;
  let generationFinishedAt: number | undefined;
  let iterationsExhausted = false;
  try {
    if (deps.generateCandidate) {
      budget.consumeModelCall();
      raw = await deps.generateCandidate(prompt, {
        budget,
        reads,
        readPage: read,
        searchWeb: search,
      });
    } else {
      const runtime = agentRuntime(agent!, tracing);
      const { mastra } = runtime;
      // Core sets the observability logger in its constructor; override it afterwards.
      tracing?.observability.setLogger({ logger: tracing.logger });
      let generated;
      try {
        generated = await mastra.getAgent("festivalResearch").generate(prompt, {
          tracingOptions: runtime.options,
          tracingContext: runtime.context,
          structuredOutput: {
            schema: modelOutputSchema(),
            // Mastra also validates intermediate tool-call commentary.
            // Final candidates still pass strict validation in prepareEditorPlan.
            errorStrategy: "warn",
            logger: noopLogger,
          },
          // Capacity failures consume Mastra iterations, so reserve retry
          // iterations while keeping ordinary research capacity intact.
          maxSteps: budget.limits.agentSteps + MAX_PROVIDER_UNAVAILABLE_RETRIES,
          stopWhen: ({ steps }: { steps: unknown[] }) =>
            steps.length - unavailableAttempts >= budget.limits.agentSteps,
          providerOptions: researchProviderOptions(config),
          modelSettings: {
            maxOutputTokens: budget.limits.modelOutputTokens,
            maxRetries: 0,
            timeout: { totalMs: Math.max(1, budget.remaining().durationMs) },
          },
          abortSignal,
          onStepFinish: (step) => {
            // Mastra also finishes failed steps without provider usage.
            if (
              step.usage?.inputTokens !== undefined ||
              step.usage?.outputTokens !== undefined
            ) {
              completedSteps += 1;
            }
            modelLog?.info("Model step completed", {
              finishReason: step.finishReason,
              usage: completedStepUsage(step),
              commentaryAvailable: !!step.text,
              reasoningAvailable: !!step.reasoningText,
              complete:
                step.finishReason !== "error" && step.finishReason !== "retry",
            });
            if (step.text && !isStructuredModelText(step.text)) {
              modelLog?.info("Model commentary observed at step completion", {
                text: shrinkText(step.text),
                originalCharacters: [...step.text].length,
                truncated: [...step.text].length > 4000,
                origin: "model-reported",
                channel: "commentary",
              });
            }
            if (step.reasoningText) {
              modelLog?.info("Provider reasoning observed at step completion", {
                text: shrinkText(step.reasoningText),
                originalCharacters: [...step.reasoningText].length,
                truncated: [...step.reasoningText].length > 4000,
                origin: "provider-returned",
                channel: "reasoning",
              });
            }
            updateModelUsage(usage, step);
          },
          onError: ({ error }) => {
            providerError = error;
            usage.complete = false;
          },
          onAbort: () => {
            usage.complete = false;
          },
          prepareStep: () => {
            abortSignal?.throwIfAborted();
            const finalOrdinaryStep =
              startedSteps >= budget.limits.agentSteps - 1;
            budget.consumeModelCall();
            startedSteps += 1;
            stepNumber = completedSteps + 1;
            attemptNumber += 1;
            modelLog = log?.child(modelContext());
            modelLog?.info("Model step started", {
              model: config.model,
              reasoningEffort: config.reasoningEffort,
              serviceTier: config.serviceTier,
              outputAllowance: budget.limits.modelOutputTokens,
              remaining: budget.remaining(),
            });
            return finalOrdinaryStep
              ? { toolChoice: "none", activeTools: [] }
              : undefined;
          },
        });
      } finally {
        // Trace cleanup can cross the deadline after generation has already finished.
        generationFinishedAt = Date.now();
        await runtime.finish();
      }
      raw = generated.object;
      throwIfProviderRetry(raw, generated.finishReason, providerError);
      iterationsExhausted = isIterationExhausted(
        raw,
        generated.finishReason,
        completedSteps,
        startedSteps + unavailableAttempts,
        budget.limits.agentSteps,
      );
      text = generated.text ?? null;
      usage.complete &&= completedSteps === startedSteps;
    }
  } catch (error) {
    traceFailure(tracing, "research_failed");
    usage.complete = false;
    if (completedSteps === 0) {
      usage.cachedInputTokens = null;
      usage.reasoningTokens = null;
    }
    const classified = classifyModelError(
      error,
      budget.deadline,
      generationFinishedAt,
    );
    logModelFailure(modelLog, classified, unavailableAttempts);
    return {
      ok: false,
      usage,
      errors: [
        {
          code: classified.limit ? "limit_reached" : "model_failed",
          stage: "research",
          message: classified.limit
            ? `Research ${classified.limit.limit} limit reached`
            : "Research model failed",
          ...(!classified.limit ? { diagnostic: classified.diagnostic } : {}),
        },
      ],
    };
  }
  if (iterationsExhausted) {
    traceFailure(tracing, "research_failed");
    return {
      ok: false,
      usage,
      modelResponse: { text, object: raw ?? null },
      errors: [
        {
          code: "limit_reached",
          stage: "research",
          message: "Research agent step limit reached",
        },
      ],
    };
  }
  if (raw == null && (generationFinishedAt ?? Date.now()) >= budget.deadline) {
    traceFailure(tracing, "research_failed");
    modelLog?.warn("Research budget exhausted", { budgetKind: "time" });
    usage.complete = false;
    return {
      ok: false,
      usage,
      modelResponse: { text, object: raw ?? null },
      errors: [
        {
          code: "limit_reached",
          stage: "research",
          message: "Research time limit reached",
        },
      ],
    };
  }
  return {
    ok: true,
    candidate: normalizeWireCandidate(raw),
    modelResponse: { text, object: raw ?? null },
    usage,
  };
}

function logModelFailure(
  log: ResearchLogger | undefined,
  classified: ReturnType<typeof classifyModelError>,
  unavailableAttempts: number,
) {
  log?.[classified.limit ? "warn" : "error"](
    classified.limit
      ? "Research budget exhausted"
      : "Model request failed permanently",
    {
      ...classified.diagnostic,
      ...(classified.limit ? { budgetKind: classified.limit.limit } : {}),
      errorCode: classified.limit ? "limit_reached" : "model_failed",
      retryExhausted: unavailableAttempts > MAX_PROVIDER_UNAVAILABLE_RETRIES,
    },
  );
}

function throwIfProviderRetry(
  object: unknown,
  finishReason: string | undefined,
  providerError: unknown,
): void {
  // Mastra can return a retry finish reason without an error object even
  // when the provider rejected the only HTTP request.
  if (object == null && finishReason === "retry") {
    throw providerError ?? new Error("Model generation failed");
  }
}

function isIterationExhausted(
  object: unknown,
  finishReason: string | undefined,
  completedSteps: number,
  attemptedSteps: number,
  agentSteps: number,
) {
  return (
    object == null &&
    finishReason === "tool-calls" &&
    (completedSteps >= agentSteps ||
      attemptedSteps >= agentSteps + MAX_PROVIDER_UNAVAILABLE_RETRIES)
  );
}

function agentRuntime(agent: Agent, tracing?: RunObservability) {
  const mastra =
    tracing?.mastra ??
    new Mastra({ logger: false, loggerOptions: { export: false } });
  mastra.addAgent(agent, "festivalResearch");
  return {
    mastra,
    options: tracing?.options,
    context: tracing?.root ? { currentSpan: tracing.root } : undefined,
    finish: () => (tracing ? Promise.resolve() : mastra.shutdown()),
  };
}

/** Structured responses belong in the research result, not commentary logs. */
function isStructuredModelText(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import type { CatalogResearchInput, ResearchDependencies } from "../contracts";
import type { ResearchContext } from "../research/context";
import type { ResearchCandidate, ResearchError } from "../research/contracts";
import { modelContext } from "../research/agent/input";
import { modelOutputSchema } from "../research/agent/wire";
import { updateModelUsage, type ModelUsage } from "../research/agent/usage";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import { classifyModelError } from "../runtime/model-errors";
import {
  createResearchModel,
  researchProviderOptions,
} from "../runtime/openrouter";
import type { RunObservability } from "../runtime/observability/runtime";
import { editorPlanSchema } from "./contracts";
import { editorInstructions } from "./prompt";

export type EditorExecution = {
  status: "success" | "failed" | "not_run";
  modelResponse: { text: string | null; object: unknown } | null;
  usage: ModelUsage;
  errors: ResearchError[];
};
export function emptyEditorExecution(): EditorExecution {
  return {
    status: "not_run",
    modelResponse: null,
    errors: [],
    usage: {
      complete: true,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      modelCostUsd: null,
    },
  };
}

export async function editResearch(
  research: ResearchCandidate,
  input: CatalogResearchInput,
  context: ResearchContext,
  budget: ResearchBudget,
  config: ResearchConfig,
  deps: Pick<ResearchDependencies, "generateEditor">,
  tracing?: RunObservability,
  abortSignal?: AbortSignal,
): Promise<EditorExecution> {
  const execution = emptyEditorExecution();
  execution.status = "failed";
  const usage = execution.usage;
  usage.complete = !deps.generateEditor;
  if (deps.generateEditor) {
    usage.cachedInputTokens = null;
    usage.reasoningTokens = null;
  }
  const saved = context.catalog.find((event) => event.id === input.eventId);
  const prompt = JSON.stringify({
    research,
    catalog: saved ? modelContext(saved) : null,
    vocabulary: context.terms,
    mode: input.mode,
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    currentDate: context.currentDate,
  });
  const log = tracing?.log?.child({ stage: "editor" });
  let runtime: Mastra | undefined;
  try {
    budget.assertTime();
    abortSignal?.throwIfAborted();
    budget.consumeModelCall();
    const timeout = AbortSignal.timeout(
      Math.max(1, budget.remaining().durationMs),
    );
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, timeout])
      : timeout;
    log?.info("Editorial generation started", {
      model: config.model,
      remaining: budget.remaining(),
    });
    if (deps.generateEditor) {
      const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
      const raw = await Promise.race([
        deps.generateEditor(prompt, { budget, abortSignal: signal }),
        aborted,
      ]);
      execution.modelResponse = { text: null, object: raw ?? null };
    } else {
      const agent = new Agent({
        id: "festival-editor",
        name: "Festival editor",
        instructions: editorInstructions,
        model: createResearchModel(config),
        errorProcessorDefaults: false,
        maxProcessorRetries: 0,
      });
      runtime =
        tracing?.mastra ??
        new Mastra({ logger: false, loggerOptions: { export: false } });
      runtime.addAgent(agent, "festivalEditor");
      tracing?.observability.setLogger({ logger: tracing.logger });
      const generated = await runtime
        .getAgent("festivalEditor")
        .generate(prompt, {
          maxSteps: 1,
          maxProcessorRetries: 0,
          activeTools: [],
          toolChoice: "none",
          tracingOptions: tracing?.options,
          tracingContext: tracing?.root
            ? { currentSpan: tracing.root }
            : undefined,
          structuredOutput: {
            schema: modelOutputSchema(editorPlanSchema),
            errorStrategy: "warn",
            logger: noopLogger,
          },
          providerOptions: researchProviderOptions(config),
          modelSettings: {
            maxOutputTokens: budget.limits.modelOutputTokens,
            maxRetries: 0,
            timeout: { totalMs: Math.max(1, budget.remaining().durationMs) },
          },
          abortSignal: signal,
          onStepFinish: (step) => updateModelUsage(usage, step),
          onError: () => {
            usage.complete = false;
          },
          onAbort: () => {
            usage.complete = false;
          },
        });
      execution.modelResponse = {
        text: generated.text ?? null,
        object: generated.object ?? null,
      };
    }
    signal.throwIfAborted();
    budget.assertTime();
    // Strict local validation and target checks happen in plan preparation.
    execution.status = "success";
    log?.info("Editorial generation finished", { usage });
  } catch (error) {
    usage.complete = false;
    const classified = classifyModelError(error, budget.deadline);
    execution.errors.push({
      code: classified.limit ? "limit_reached" : "model_failed",
      stage: "editor",
      message: classified.limit
        ? "Editor time limit reached"
        : "Editor generation failed",
      ...(!classified.limit ? { diagnostic: classified.diagnostic } : {}),
    });
    log?.warn("Editorial generation failed", {
      errorCode: execution.errors[0].code,
    });
  } finally {
    if (runtime && !tracing) {
      await runtime.shutdown();
    }
  }
  return execution;
}

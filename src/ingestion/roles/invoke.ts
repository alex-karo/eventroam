import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import type { ToolsInput } from "@mastra/core/agent";
import { z } from "zod";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchBudget } from "../runtime/budget";
import { traceFailure } from "../runtime/tracing";
import { ResearchLimitError } from "../runtime/budget";
import type { ResearchError } from "../research/contracts";
import type { RunObservability } from "../runtime/observability/runtime";
import { modelOutputSchema } from "../runtime/model-output";
import {
  createResearchModel,
  researchProviderOptions,
  providerUnavailableRetry,
  MAX_PROVIDER_UNAVAILABLE_RETRIES,
} from "../runtime/openrouter";
import { shrinkText, type ResearchLogger } from "../runtime/logging";
import { classifyModelError } from "../runtime/model-errors";

export type Role =
  | "research"
  | "reader"
  | "general"
  | "tickets"
  | "classification"
  | "links"
  | "editor";
export type GenerateRole = (
  role: Role,
  prompt: string,
  context: {
    budget: ResearchBudget;
    abortSignal: AbortSignal;
    tools?: ToolsInput;
  },
) => Promise<unknown>;
export type RoleExecution<T = unknown> = {
  status: "success" | "failed" | "not_run";
  output?: T;
  modelResponse: { text: string | null; object: unknown } | null;
  errors: ResearchError[];
  skipReason?: string;
  model: string;
  promptVersion: string;
  durationMs: number;
};

/** Restore only nullable wire placeholders for fields that are optional locally. */
function localWire(value: unknown, schema: Record<string, unknown>): unknown {
  if (value == null) {
    return value;
  }
  const branches = (schema.anyOf ?? schema.oneOf) as
    Record<string, unknown>[] | undefined;
  if (branches) {
    const record =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const branch =
      branches.find((item) => {
        if (item.type !== (Array.isArray(value) ? "array" : typeof value)) {
          return false;
        }
        const properties = item.properties as
          Record<string, { const?: unknown; enum?: unknown[] }> | undefined;
        return (
          !record ||
          !properties ||
          Object.entries(properties).every(
            ([key, spec]) =>
              (!("const" in spec) || record[key] === spec.const) &&
              (!spec.enum || spec.enum.includes(record[key])),
          )
        );
      }) ?? branches.find((item) => item.type !== "null");
    return branch ? localWire(value, branch) : value;
  }
  if (Array.isArray(value)) {
    return value.map((part) =>
      localWire(part, (schema.items ?? {}) as Record<string, unknown>),
    );
  }
  if (typeof value !== "object") {
    return value;
  }
  const properties = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((schema.required ?? []) as string[]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, part]) =>
          !(part === null && properties[key] && !required.has(key)),
      )
      .map(([key, part]) => [key, localWire(part, properties[key] ?? {})]),
  );
}

function logStep(
  log: ResearchLogger | undefined,
  step: { finishReason?: string; text?: string; reasoningText?: string },
) {
  log?.info("Model step completed", {
    finishReason: step.finishReason,
    commentaryAvailable: !!step.text,
    reasoningAvailable: !!step.reasoningText,
    complete: step.finishReason !== "error" && step.finishReason !== "retry",
  });
  for (const [channel, text] of [
    ["commentary", step.text],
    ["reasoning", step.reasoningText],
  ] as const) {
    if (!text) {
      continue;
    }
    if (channel === "commentary") {
      try {
        JSON.parse(text);
        continue;
      } catch {
        /* Log non-structured commentary. */
      }
    }
    log?.info(
      channel === "commentary"
        ? "Model commentary observed at step completion"
        : "Provider reasoning observed at step completion",
      {
        text: shrinkText(text),
        originalCharacters: [...text].length,
        truncated: [...text].length > 4000,
        origin:
          channel === "commentary" ? "model-reported" : "provider-returned",
        channel,
      },
    );
  }
}

function checkGeneration(
  generated: { object?: unknown; finishReason?: string },
  providerError: unknown,
  startedSteps: number,
  ordinarySteps: number,
) {
  if (
    !generated.object &&
    (generated.finishReason === "error" ||
      generated.finishReason === "retry") &&
    providerError
  ) {
    throw providerError;
  }
  if (
    !generated.object &&
    startedSteps >= ordinarySteps &&
    generated.finishReason === "tool-calls"
  ) {
    throw new ResearchLimitError("steps");
  }
}

function acceptRoleOutput<T>(
  execution: RoleExecution<T>,
  schema: z.ZodType<T>,
  role: Role,
  native: boolean,
) {
  const normalized = localWire(
    role === "general" && native
      ? (execution.modelResponse!.object as { result?: unknown } | null)?.result
      : execution.modelResponse!.object,
    z.toJSONSchema(schema),
  );
  const parsed = schema.safeParse(normalized);
  if (!parsed.success) {
    execution.errors.push({
      code: role === "editor" ? "invalid_plan" : "invalid_candidate",
      stage: role === "editor" ? "editor" : "research",
      message: `${role}: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}:${issue.code}`)
        .join(", ")}`,
    });
  } else {
    execution.output = parsed.data;
    execution.status = "success";
  }
}

export async function invokeRole<T>(options: {
  role: Role;
  version: string;
  instructions: string;
  input: unknown;
  schema: z.ZodType<T>;
  budget: ResearchBudget;
  config: ResearchConfig;
  signal?: AbortSignal;
  tracing?: RunObservability;
  generate?: GenerateRole;
  tools?: ToolsInput;
  steps?: number;
  deadline?: number;
  outputTokens?: number;
}): Promise<RoleExecution<T>> {
  const { role, budget, config, tracing } = options;
  const started = Date.now();
  const execution: RoleExecution<T> = {
    status: "failed",
    modelResponse: null,
    errors: [],
    model: config.model,
    promptVersion: options.version,
    durationMs: 0,
  };
  let runtime: Mastra | undefined;
  let providerError: unknown;
  let unavailableAttempts = 0;
  let startedSteps = 0;
  let modelLog = tracing?.log?.child({ stage: role, step: 0, attempt: 0 });
  const ordinarySteps = options.steps ?? 1;
  try {
    budget.assertTime();
    const signal = AbortSignal.any([
      ...(options.signal ? [options.signal] : []),
      AbortSignal.timeout(
        Math.max(1, (options.deadline ?? budget.deadline) - Date.now()),
      ),
    ]);
    signal.throwIfAborted();
    const prompt = JSON.stringify(options.input);
    if (prompt.length > 400000) {
      throw new ResearchLimitError("context");
    }
    const wireSchema =
      role === "general"
        ? z.strictObject({ result: options.schema })
        : options.schema;
    if (options.generate) {
      budget.consumeModelCall();
      const raw = await options.generate(role, prompt, {
        budget,
        abortSignal: signal,
        tools: options.tools,
      });
      execution.modelResponse = { text: null, object: raw ?? null };
    } else {
      const agent = new Agent({
        id: `festival-${role}`,
        name: `Festival ${role}`,
        instructions: options.instructions,
        model: createResearchModel(config),
        tools: options.tools,
        errorProcessorDefaults: false,
        maxProcessorRetries: MAX_PROVIDER_UNAVAILABLE_RETRIES,
        errorProcessors: [
          providerUnavailableRetry(
            budget,
            () => {
              unavailableAttempts += 1;
              startedSteps -= 1;
            },
            tracing?.log,
          ),
        ],
      });
      runtime =
        tracing?.mastra ??
        new Mastra({ logger: false, loggerOptions: { export: false } });
      runtime.addAgent(agent, `festival-${role}`);
      tracing?.observability.setLogger({ logger: tracing.logger });
      const generated = await agent.generate(prompt, {
        runId: tracing?.options.metadata.runId,
        tracingOptions: tracing?.options,
        tracingContext: tracing?.root
          ? { currentSpan: tracing.root }
          : undefined,
        structuredOutput: {
          schema: modelOutputSchema(wireSchema),
          errorStrategy: "warn",
          logger: noopLogger,
        },
        maxSteps: ordinarySteps + MAX_PROVIDER_UNAVAILABLE_RETRIES,
        stopWhen: ({ steps }: { steps: unknown[] }) =>
          steps.length - unavailableAttempts >= ordinarySteps,
        toolCallConcurrency: { limit: 3, strategy: "called" },
        providerOptions: {
          openrouter: {
            ...researchProviderOptions(config).openrouter,
            ...(role === "reader" && {
              prompt_cache_options: { mode: "explicit" },
            }),
          },
        },
        modelSettings: {
          maxOutputTokens:
            options.outputTokens ?? budget.limits.modelOutputTokens,
          maxRetries: 0,
          timeout: {
            totalMs: Math.max(
              1,
              (options.deadline ?? budget.deadline) - Date.now(),
            ),
          },
        },
        abortSignal: signal,
        onError: ({ error }) => {
          providerError = error;
        },
        onStepFinish: (step) => logStep(modelLog, step),
        prepareStep: () => {
          signal.throwIfAborted();
          budget.consumeModelCall();
          startedSteps += 1;
          modelLog = tracing?.log?.child({
            stage: role,
            step: startedSteps,
            attempt: startedSteps + unavailableAttempts,
          });
          modelLog?.info("Model step started", {
            model: config.model,
            reasoningEffort: config.reasoningEffort,
            serviceTier: config.serviceTier,
            outputAllowance:
              options.outputTokens ?? budget.limits.modelOutputTokens,
            remaining: budget.remaining(),
          });
          return startedSteps >= ordinarySteps
            ? { toolChoice: "none", activeTools: [] }
            : undefined;
        },
      });
      execution.modelResponse = {
        text: generated.text ?? null,
        object: generated.object ?? null,
      };
      checkGeneration(generated, providerError, startedSteps, ordinarySteps);
    }
    signal.throwIfAborted();
    acceptRoleOutput(execution, options.schema, role, !options.generate);
  } catch (error) {
    traceFailure(tracing, "research_failed");
    const classified = classifyModelError(
      error,
      options.deadline ?? budget.deadline,
    );
    execution.errors.push({
      code: classified.limit ? "limit_reached" : "model_failed",
      stage: options.role === "editor" ? "editor" : "research",
      message: `${role} execution failed`,
      diagnostic: classified.diagnostic,
    });
  } finally {
    execution.durationMs = Date.now() - started;
    if (runtime && !tracing) {
      await runtime.shutdown();
    }
  }
  return execution;
}

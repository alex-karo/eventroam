import { Agent, type ToolsInput } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import { z } from "zod";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchBudget } from "../runtime/budget";
import { traceFailure } from "../runtime/tracing";
import { ResearchLimitError } from "../runtime/budget";
import type { ResearchError } from "../research/contracts";
import type { RunObservability } from "../runtime/observability/runtime";
import { completedObject, modelOutputSchema } from "../runtime/model-output";
import {
  createResearchModelOptions,
  providerUnavailableRetry,
  MAX_PROVIDER_UNAVAILABLE_RETRIES,
} from "../runtime/openrouter";
import { shrinkText, type ResearchLogger } from "../runtime/logging";
import type { FullOutput } from "@mastra/core/stream";
import type { GroupOwner } from "../groups";
import { classifyModelError } from "../runtime/model-errors";

export type Role =
  | "research"
  | "reader"
  | "general"
  | "tickets"
  | "classification"
  | "links"
  | "editor"
  | "location";
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

export type RoleConversation = {
  raw: unknown;
  schema: z.ZodType;
  revise?: (
    input: unknown,
    tools: ToolsInput,
    signal: AbortSignal,
  ) => Promise<RoleExecution>;
};

export function repairableRole(role: Role): role is GroupOwner {
  return role !== "research" && role !== "reader" && role !== "editor";
}

function acceptRoleOutput<T>(
  execution: RoleExecution<T>,
  schema: z.ZodType<T>,
  role: Role,
  normalized: unknown,
) {
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

type RoleInvocation<T> = {
  role: Role;
  version: string;
  instructions: string;
  cacheInstructions?: boolean;
  input: unknown;
  schema: z.ZodType<T>;
  normalizeOutput?: (value: unknown) => unknown;
  budget: ResearchBudget;
  config: ResearchConfig;
  signal?: AbortSignal;
  tracing?: RunObservability;
  generate?: GenerateRole;
  tools?: ToolsInput;
  steps?: number;
  deadline?: number;
  outputTokens?: number;
  capture?: (role: GroupOwner, conversation: RoleConversation) => void;
  messages?: FullOutput["messages"];
};

async function generateNativeReply<T>(
  options: RoleInvocation<T>,
  runtime: Mastra,
  prompt: string,
  signal: AbortSignal,
  execution: RoleExecution<T>,
): Promise<FullOutput["messages"] | undefined> {
  const { role, budget, config, tracing } = options;
  let providerError: unknown;
  let unavailableAttempts = 0;
  let startedSteps = 0;
  let modelLog = tracing?.log?.child({ stage: role, step: 0, attempt: 0 });
  const ordinarySteps = options.steps ?? 1;
  const wireSchema =
    role === "general"
      ? z.strictObject({ result: options.schema })
      : options.schema;
  const { model, instructions, providerOptions } = createResearchModelOptions(
    config,
    options,
  );
  const agent = new Agent({
    id: `festival-${role}`,
    name: `Festival ${role}`,
    instructions,
    model,
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
  runtime.addAgent(agent, `festival-${role}`);
  tracing?.observability.setLogger({ logger: tracing.logger });
  const generated = await agent.generate(
    options.messages
      ? [...options.messages, { role: "user", content: prompt }]
      : prompt,
    {
      runId: tracing?.options.metadata.runId,
      tracingOptions: tracing?.options,
      tracingContext: tracing?.root ? { currentSpan: tracing.root } : undefined,
      structuredOutput: {
        schema: modelOutputSchema(wireSchema),
        errorStrategy: "warn",
        logger: noopLogger,
      },
      maxSteps: ordinarySteps + MAX_PROVIDER_UNAVAILABLE_RETRIES,
      stopWhen: ({ steps }: { steps: unknown[] }) =>
        steps.length - unavailableAttempts >= ordinarySteps,
      toolCallConcurrency: { limit: 3, strategy: "called" },
      providerOptions,
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
    },
  );
  execution.modelResponse = {
    text: generated.text ?? null,
    object:
      repairableRole(role) && generated.finishReason === "stop"
        ? completedObject(generated)
        : (generated.object ?? null),
  };
  checkGeneration(generated, providerError, startedSteps, ordinarySteps);
  if (repairableRole(role) && generated.finishReason !== "stop") {
    throw new Error(
      `The ${role} response did not finish: ${generated.finishReason}`,
    );
  }
  if (generated.finishReason === "stop" && generated.messages.length) {
    return generated.messages;
  }
}

export async function invokeRole<T>(
  options: RoleInvocation<T>,
): Promise<RoleExecution<T>> {
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
  let messages: FullOutput["messages"] | undefined;
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
    if (options.generate) {
      budget.consumeModelCall();
      const raw = await options.generate(role, prompt, {
        budget,
        abortSignal: signal,
        tools: options.tools,
      });
      execution.modelResponse = { text: null, object: raw ?? null };
    } else {
      runtime =
        tracing?.mastra ??
        new Mastra({ logger: false, loggerOptions: { export: false } });
      messages = await generateNativeReply(
        options,
        runtime,
        prompt,
        signal,
        execution,
      );
    }
    signal.throwIfAborted();
    const object = execution.modelResponse?.object;
    const raw =
      role === "general" && !options.generate
        ? (object as { result?: unknown } | null)?.result
        : object;
    const normalized = options.normalizeOutput
      ? options.normalizeOutput(raw)
      : raw;
    if (
      repairableRole(role) &&
      normalized != null &&
      (options.generate || messages)
    ) {
      const history = messages;
      options.capture?.(role, {
        raw: normalized,
        schema: options.schema,
        ...(history && {
          revise: (input, tools, signal) =>
            invokeRole({
              ...options,
              input,
              tools,
              signal,
              steps: 6,
              messages: history,
              capture: undefined,
            }),
        }),
      });
    }
    if (options.messages && normalized != null) {
      execution.output = normalized as T;
      execution.status = "success";
    } else {
      acceptRoleOutput(execution, options.schema, role, normalized);
    }
  } catch (error) {
    const classified = classifyModelError(
      error,
      options.deadline ?? budget.deadline,
    );
    if (
      !classified.limit &&
      options.signal?.aborted &&
      error === options.signal.reason
    ) {
      throw error;
    }
    traceFailure(tracing, "research_failed");
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

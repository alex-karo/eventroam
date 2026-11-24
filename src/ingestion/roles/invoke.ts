import {
  Agent,
  type AgentExecutionOptions,
  type ToolsInput,
} from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import type { AnySpan } from "@mastra/core/observability";
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
import { record, type GroupOwner } from "../groups";
import { classifyModelError } from "../runtime/model-errors";
import { validateSchema, type ReplyValidation } from "./validation";
import { normalizeRoleWire } from "./wire";

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

export type RoleConversation = {
  raw: unknown;
  schema: z.ZodType;
  revise?: (input: unknown, signal: AbortSignal) => Promise<RoleExecution>;
};

function repairableRole(role: Role): role is GroupOwner {
  return role !== "research" && role !== "reader" && role !== "editor";
}

type RoleModelOptions<T> = {
  role: Role;
  instructions: string;
  cacheInstructions?: boolean;
  schema: z.ZodType<T>;
  budget: ResearchBudget;
  config: ResearchConfig;
  tools?: ToolsInput;
  steps?: number;
  outputTokens?: number;
  messages?: FullOutput["messages"];
};

type RoleInvocation<T> = RoleModelOptions<T> & {
  version: string;
  input: unknown;
  validateReply?: (value: unknown) => ReplyValidation<T>;
  reserveCorrection?: () => boolean;
  signal?: AbortSignal;
  tracing?: RunObservability;
  generate?: GenerateRole;
  capture?: (role: GroupOwner, conversation: RoleConversation) => void;
};

type MastraReplyOptions = RoleModelOptions<unknown> & {
  prompt: string;
  signal: AbortSignal;
  agentKey?: string;
  parentSpan?: AnySpan;
  log?: ResearchLogger;
  retryUnavailable: boolean;
  recoverRaw: boolean;
  toolCallConcurrency?: AgentExecutionOptions["toolCallConcurrency"];
};

async function generateMastraReply(
  runtime: Mastra,
  tracing: RunObservability | undefined,
  options: MastraReplyOptions,
) {
  const { role, budget, config, signal, prompt, messages, log } = options;
  let providerError: unknown;
  let unavailableAttempts = 0;
  let startedSteps = 0;
  let modelLog = log?.child({ stage: role, step: 0, attempt: 0 });
  const ordinarySteps = options.steps ?? 1;
  const outputAllowance =
    options.outputTokens ?? budget.limits.modelOutputTokens;
  const retries = options.retryUnavailable
    ? MAX_PROVIDER_UNAVAILABLE_RETRIES
    : 0;
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
    maxProcessorRetries: retries,
    errorProcessors: retries
      ? [
          providerUnavailableRetry(
            budget,
            () => {
              unavailableAttempts += 1;
              startedSteps -= 1;
            },
            log,
          ),
        ]
      : undefined,
  });
  runtime.addAgent(agent, options.agentKey);
  tracing?.observability.setLogger({ logger: tracing.logger });
  const generated = await agent.generate(
    messages ? [...messages, { role: "user", content: prompt }] : prompt,
    {
      runId: tracing?.options.metadata.runId,
      tracingOptions: tracing?.options,
      tracingContext: options.parentSpan
        ? { currentSpan: options.parentSpan }
        : undefined,
      structuredOutput: {
        schema: modelOutputSchema(options.schema),
        errorStrategy: "warn",
        logger: noopLogger,
      },
      maxSteps: ordinarySteps + retries,
      stopWhen: retries
        ? ({ steps }: { steps: unknown[] }) =>
            steps.length - unavailableAttempts >= ordinarySteps
        : undefined,
      toolCallConcurrency: options.toolCallConcurrency,
      providerOptions,
      modelSettings: {
        maxOutputTokens: outputAllowance,
        maxRetries: 0,
        timeout: {
          totalMs: Math.max(1, budget.remaining().durationMs),
        },
      },
      abortSignal: signal,
      onError: retries
        ? ({ error }) => {
            providerError = error;
          }
        : undefined,
      onStepFinish: log ? (step) => logStep(modelLog, step) : undefined,
      prepareStep: () => {
        signal.throwIfAborted();
        budget.consumeModelCall();
        startedSteps += 1;
        modelLog = log?.child({
          stage: role,
          step: startedSteps,
          attempt: startedSteps + unavailableAttempts,
        });
        modelLog?.info("Model step started", {
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          serviceTier: config.serviceTier,
          outputAllowance,
          remaining: budget.remaining(),
        });
        return startedSteps >= ordinarySteps
          ? { toolChoice: "none", activeTools: [] }
          : undefined;
      },
    },
  );
  const completed = generated.finishReason === "stop";
  return {
    modelResponse: {
      text: generated.text ?? null,
      object:
        options.recoverRaw && completed
          ? completedObject(generated)
          : (generated.object ?? null),
    },
    finishReason: generated.finishReason,
    messages:
      completed && generated.messages.length ? generated.messages : undefined,
    providerError,
    stepLimitReached: startedSteps >= ordinarySteps,
  };
}

export function createRoleModelRunner(tracing?: RunObservability) {
  let runtime: Mastra | undefined;
  return {
    generate(options: MastraReplyOptions) {
      runtime ??=
        tracing?.mastra ??
        new Mastra({ logger: false, loggerOptions: { export: false } });
      return generateMastraReply(runtime, tracing, options);
    },
    async close() {
      if (runtime && !tracing) {
        await runtime.shutdown();
      }
    },
  };
}

async function generateReply<T>(
  options: RoleInvocation<T>,
  runner: ReturnType<typeof createRoleModelRunner>,
  prompt: string,
  signal: AbortSignal,
  execution: RoleExecution<T>,
  history: FullOutput["messages"] | undefined,
  correction: boolean,
): Promise<FullOutput["messages"] | undefined> {
  const { role, budget, tracing } = options;
  if (options.generate) {
    budget.consumeModelCall();
    const raw = await options.generate(role, prompt, {
      budget,
      abortSignal: signal,
      tools: options.tools,
    });
    execution.modelResponse = { text: null, object: raw ?? null };
    return;
  }
  const recoverRaw = repairableRole(role) || !!options.validateReply;
  const generated = await runner.generate({
    ...options,
    schema:
      role === "general"
        ? z.strictObject({ result: options.schema })
        : options.schema,
    prompt,
    signal,
    messages: history,
    agentKey: correction ? `festival-${role}-correction` : undefined,
    parentSpan: tracing?.root,
    log: tracing?.log,
    retryUnavailable: true,
    recoverRaw,
    toolCallConcurrency: { limit: 3, strategy: "called" },
  });
  execution.modelResponse = generated.modelResponse;
  const { finishReason, providerError, stepLimitReached } = generated;
  if (!generated.modelResponse.object) {
    if (
      providerError &&
      (finishReason === "error" || finishReason === "retry")
    ) {
      throw providerError;
    }
    if (stepLimitReached && finishReason === "tool-calls") {
      throw new ResearchLimitError("steps");
    }
  }
  if (recoverRaw && finishReason !== "stop") {
    throw new Error(`The ${role} response did not finish: ${finishReason}`);
  }
  return generated.messages;
}

function validateCompletedReply<T>(
  options: RoleInvocation<T>,
  execution: RoleExecution<T>,
  messages: FullOutput["messages"] | undefined,
): ReplyValidation<T> {
  const { role } = options;
  const object = execution.modelResponse?.object;
  const raw =
    role === "general" && !options.generate
      ? (object as { result?: unknown } | null)?.result
      : object;
  const normalized = normalizeRoleWire(role, raw);
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
        revise: (input, signal) =>
          invokeRole({
            ...options,
            input,
            tools: undefined,
            signal,
            steps: 1,
            messages: history,
            capture: undefined,
          }),
      }),
    });
  }
  // Group revisions are validated against their requested scope before merge.
  if (options.messages && normalized != null) {
    return { status: "accepted", output: normalized as T };
  }
  return options.validateReply
    ? options.validateReply(normalized)
    : validateSchema(options.schema, normalized, role);
}

function rolePrompt(
  input: unknown,
  hasHistory: boolean,
  validationFeedback?: { instructions: string; errors: ResearchError[] },
) {
  const prompt = JSON.stringify(
    validationFeedback
      ? {
          ...(!hasHistory && (record(input) ?? { input })),
          validationFeedback,
        }
      : input,
  );
  if (prompt.length > 400000) {
    throw new ResearchLimitError("context");
  }
  return prompt;
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
  const runner = createRoleModelRunner(tracing);
  try {
    budget.assertTime();
    const signal = AbortSignal.any([
      ...(options.signal ? [options.signal] : []),
      AbortSignal.timeout(Math.max(1, budget.deadline - Date.now())),
    ]);
    let history = options.messages;
    let validationFeedback:
      { instructions: string; errors: ResearchError[] } | undefined;
    for (;;) {
      signal.throwIfAborted();
      const correcting = validationFeedback !== undefined;
      const attempt = correcting
        ? { ...options, steps: 1, tools: undefined }
        : options;
      const messages = await generateReply(
        attempt,
        runner,
        rolePrompt(options.input, !!history, validationFeedback),
        signal,
        execution,
        history,
        correcting,
      );
      signal.throwIfAborted();
      const result = validateCompletedReply(options, execution, messages);
      if (result.status === "accepted") {
        execution.output = result.output;
        execution.status = "success";
        break;
      }
      if (
        result.status !== "retry" ||
        correcting ||
        options.reserveCorrection?.() === false
      ) {
        execution.errors.push(...result.errors);
        break;
      }
      const { instructions, errors } = result;
      tracing?.log?.info("Model reply correction requested", {
        stage: role,
        errors,
      });
      validationFeedback = { instructions, errors };
      history = messages;
    }
  } catch (error) {
    const classified = classifyModelError(error, budget.deadline);
    if (
      !classified.limit &&
      options.signal?.aborted &&
      error === options.signal.reason
    ) {
      throw error;
    }
    traceFailure(tracing, "research_failed", {
      error,
      metadata: {
        role,
        model: config.model,
        ...classified.diagnostic,
        ...(classified.limit ? { limit: classified.limit.limit } : {}),
      },
    });
    execution.errors.push({
      code: classified.limit ? "limit_reached" : "model_failed",
      stage: options.role === "editor" ? "editor" : "research",
      message: `${role} execution failed`,
      diagnostic: classified.diagnostic,
    });
  } finally {
    execution.durationMs = Date.now() - started;
    await runner.close();
  }
  return execution;
}

import { SpanType, type AnySpan } from "@mastra/core/observability";
import { observeTrace, traceFailure } from "../../runtime/tracing/spans";
import type { FullOutput } from "@mastra/core/stream";
import {
  createRoleModelRunner,
  invokeRole,
  type RoleConversation,
} from "../invoke";
import { z } from "zod";
import type { ResearchBudget } from "../../runtime/budget";
import type { ResearchConfig } from "../../runtime/config";
import type { RunObservability } from "../../runtime/observability/runtime";
import type { GeocodingClient } from "../../tools/geocode/contracts";
import { createGeocodingSession } from "../../tools/geocode/tool";
import { LOCATION_PROMPT_VERSION, locationOutputSchema } from "./contracts";
import type { LocationInput } from "./input";
import { prepareInitialGeocoding } from "./initial";
import { locationInstructions } from "./prompt";
import { returnInstructions } from "../prompts";
import {
  LocationCountryConflictError,
  LocationValidationError,
  validateLocationReply,
} from "./validate";
import { emptyLocationExecution, type LocationExecution } from "./execution";
import { locationFailureMessage } from "./failure";
export { emptyLocationExecution, type LocationExecution } from "./execution";
export type GenerateLocation = (
  prompt: string,
  context: {
    budget: ResearchBudget;
    abortSignal: AbortSignal;
    geocode: (input: {
      query: string;
      countryCode: string | null;
    }) => Promise<unknown>;
  },
) => Promise<unknown>;
function validationMessage(error: unknown): string {
  if (error instanceof LocationValidationError) {
    return error.message;
  }
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}:${issue.code}`)
      .join("; ");
  }
  return locationFailureMessage(error);
}
function locationDiagnostic(
  error: unknown,
  budget: ResearchBudget,
  signal: AbortSignal,
): LocationExecution["errors"][number] {
  const timedOut =
    budget.remaining().durationMs <= 0 ||
    signal.reason?.name === "TimeoutError";
  if (error instanceof LocationCountryConflictError) {
    return {
      code: "country_conflict",
      stage: "validation",
      editionKey: error.editionKey,
      field: "countryCode",
      message: error.message,
    };
  }
  return {
    code: timedOut ? "limit_reached" : "location_failed",
    stage: "location",
    message: timedOut
      ? "Location reached the run deadline"
      : validationMessage(error),
  };
}

function locationModelConfig(config: ResearchConfig) {
  return {
    ...config,
    model: config.locationModel ?? config.model,
    reasoningEffort:
      config.reasoningEffort === "low"
        ? ("medium" as const)
        : config.reasoningEffort,
  };
}

type StartGeocodingObservation = NonNullable<
  NonNullable<Parameters<typeof createGeocodingSession>[2]>["startObservation"]
>;

function observeGeocoding(
  tracing: RunObservability | undefined,
  span: AnySpan | undefined,
  direction: Parameters<StartGeocodingObservation>[0],
  origin: Parameters<StartGeocodingObservation>[1],
): ReturnType<StartGeocodingObservation> {
  let requestSpan: AnySpan | undefined;
  try {
    requestSpan = (span ?? tracing?.root)?.createChildSpan({
      type: SpanType.GENERIC,
      name: "geocoding",
      entityId: "geocoding",
    });
  } catch {
    tracing?.diagnose("trace_export_failed");
  }
  return (observation) => {
    observeTrace(tracing, requestSpan, {
      name: `geocoding · ${origin} · ${direction}`,
      input: { direction, origin },
      output: {
        status: observation.result.status,
        ...(observation.result.status === "error"
          ? { code: observation.result.code }
          : {}),
        cacheHit: observation.cacheHit,
        slots: observation.slots,
        candidateCount: observation.pointIds.length,
      },
    });
    if (observation.result.status === "error") {
      traceFailure(tracing, "geocoding_failed", requestSpan);
    }
    try {
      requestSpan?.end();
    } catch {
      tracing?.diagnose("trace_export_failed");
    }
  };
}

type CaptureLocation = (
  conversation: RoleConversation,
  input: LocationInput,
  session: Pick<
    ReturnType<typeof createGeocodingSession>,
    "points" | "targets"
  >,
) => void;

function captureLocationReply(
  capture: CaptureLocation | undefined,
  raw: unknown,
  injected: boolean,
  messages: FullOutput["messages"] | undefined,
  input: LocationInput,
  session: ReturnType<typeof createGeocodingSession>,
  options: {
    instructions: string;
    budget: ResearchBudget;
    config: ResearchConfig;
    tracing: RunObservability | undefined;
  },
) {
  const { instructions, budget, config, tracing } = options;
  if (raw != null && (injected || messages)) {
    const history = messages;
    capture?.(
      {
        raw,
        schema: locationOutputSchema,
        ...(history && {
          revise: (input, signal) =>
            invokeRole({
              role: "location",
              version: LOCATION_PROMPT_VERSION,
              instructions,
              input,
              schema: locationOutputSchema,
              budget,
              config: locationModelConfig(config),
              tracing,
              signal,
              messages: history,
            }),
        }),
      },
      input,
      { points: session.points, targets: session.targets },
    );
  }
}

export async function resolveLocation(
  input: LocationInput,
  budget: ResearchBudget,
  config: ResearchConfig,
  deps: {
    generateLocation?: GenerateLocation;
    geocodingClient?: GeocodingClient;
  } = {},
  tracing?: RunObservability,
  abortSignal?: AbortSignal,
  capture?: CaptureLocation,
): Promise<LocationExecution> {
  const execution = emptyLocationExecution();
  execution.status = "failed";
  let span: AnySpan | undefined;
  try {
    span = tracing?.root?.createChildSpan({
      type: SpanType.GENERIC,
      name: "resolve-location",
      entityId: "resolve-location",
    });
  } catch {
    tracing?.diagnose("trace_export_failed");
  }
  const session = createGeocodingSession(input, budget, {
    apiKey: config.geoapifyKey,
    client: deps.geocodingClient,
    abortSignal,
    startObservation: (direction, origin) =>
      observeGeocoding(tracing, span, direction, origin),
  });
  const runner = createRoleModelRunner(tracing);
  let messages: FullOutput["messages"] | undefined;
  const instructions = locationInstructions + returnInstructions;

  try {
    await prepareInitialGeocoding(input, session);
    session.signal.throwIfAborted();
    budget.assertTime();
    const prompt = JSON.stringify({
      ...input,
      prepared: session.observations,
      points: [...session.points.values()],
      targetPoints: session.targets,
      remainingCalls: 6 - session.calls,
      remaining: budget.remaining(),
    });
    if (deps.generateLocation) {
      budget.consumeModelCall();
      execution.modelResponse = {
        text: null,
        object: await new Promise<unknown>((resolve, reject) => {
          const aborted = () => reject(session.signal.reason);
          session.signal.addEventListener("abort", aborted, { once: true });
          deps.generateLocation!(prompt, {
            budget,
            abortSignal: session.signal,
            geocode: session.forward,
          })
            .then(resolve, reject)
            .finally(() =>
              session.signal.removeEventListener("abort", aborted),
            );
        }),
      };
    } else {
      const output = await runner.generate({
        role: "location",
        agentKey: "festivalLocation",
        instructions,
        prompt,
        signal: session.signal,
        schema: locationOutputSchema,
        budget,
        config: locationModelConfig(config),
        steps: 8,
        parentSpan: span,
        tools: { geocode: session.tool },
        retryUnavailable: false,
        recoverRaw: true,
      });
      execution.modelResponse = output.modelResponse;
      if (output.finishReason !== "stop") {
        throw new Error("Location response did not finish");
      }
      messages = output.messages;
    }
    session.signal.throwIfAborted();
    budget.assertTime();
    captureLocationReply(
      capture,
      execution.modelResponse.object,
      !!deps.generateLocation,
      messages,
      input,
      session,
      {
        instructions,
        budget,
        config,
        tracing,
      },
    );
    const validated = validateLocationReply(
      execution.modelResponse.object,
      input,
      session,
    );
    if (validated.status === "rejected") {
      execution.status = "rejected";
      execution.errors.push({
        code: "location_rejected",
        stage: "location",
        message: validated.reason,
      });
      return execution;
    }
    execution.materialized = validated.materialized;
    execution.status = "success";
  } catch (error) {
    execution.errors.push(locationDiagnostic(error, budget, session.signal));
  } finally {
    observeTrace(tracing, span, {
      name: "resolve-location",
      metadata: { promptVersion: LOCATION_PROMPT_VERSION },
      output: { status: execution.status, geocodingCalls: session.calls },
    });
    if (execution.status === "failed") {
      traceFailure(tracing, "location_failed", span);
    }
    try {
      span?.end();
    } catch {
      tracing?.diagnose("trace_export_failed");
    }
    execution.observations = session.observations;
    execution.points = [...session.points.values()];
    await runner.close();
  }
  return execution;
}

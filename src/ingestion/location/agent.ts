import { SpanType, type AnySpan } from "@mastra/core/observability";
import { observeTrace, traceFailure } from "../runtime/tracing/spans";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import { z } from "zod";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { RunObservability } from "../runtime/observability/runtime";
import {
  createResearchModel,
  researchProviderOptions,
} from "../runtime/openrouter";
import type { GeocodingClient } from "../tools/geocode/contracts";
import { createGeocodingSession } from "../tools/geocode/tool";
import {
  LOCATION_PROMPT_VERSION,
  locationModelOutputSchema,
  locationOutputSchema,
} from "./contracts";
import type { LocationInput } from "./input";
import { prepareInitialGeocoding } from "./initial";
import { locationInstructions } from "./prompt";
import {
  LocationCountryConflictError,
  LocationValidationError,
  validateLocation,
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
    startObservation: (direction, origin) => {
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
    },
  });
  let runtime: Mastra | undefined;
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
      const model = locationModelConfig(config);
      const agent = new Agent({
        id: "festival-location",
        name: "Festival location",
        instructions: locationInstructions,
        model: createResearchModel(model),
        tools: { geocode: session.tool },
        errorProcessorDefaults: false,
        maxProcessorRetries: 0,
      });
      runtime =
        tracing?.mastra ??
        new Mastra({ logger: false, loggerOptions: { export: false } });
      runtime.addAgent(agent, "festivalLocation");
      tracing?.observability.setLogger({ logger: tracing.logger });
      let steps = 0;
      const output = await runtime
        .getAgent("festivalLocation")
        .generate(prompt, {
          runId: tracing?.options.metadata.runId,
          maxSteps: 8,
          maxProcessorRetries: 0,
          structuredOutput: {
            schema: locationModelOutputSchema(),
            errorStrategy: "warn",
            logger: noopLogger,
          },
          tracingOptions: tracing?.options,
          tracingContext: span ? { currentSpan: span } : undefined,
          providerOptions: researchProviderOptions(model),
          modelSettings: {
            maxOutputTokens: budget.limits.modelOutputTokens,
            maxRetries: 0,
            timeout: { totalMs: Math.max(1, budget.remaining().durationMs) },
          },
          abortSignal: session.signal,
          prepareStep: () => {
            session.signal.throwIfAborted();
            budget.consumeModelCall();
            steps += 1;
            return steps === 8
              ? { activeTools: [], toolChoice: "none" }
              : undefined;
          },
        });
      execution.modelResponse = {
        text: output.text ?? null,
        object: output.object ?? null,
      };
    }
    session.signal.throwIfAborted();
    budget.assertTime();
    const { decision } = locationOutputSchema.parse(
      execution.modelResponse.object,
    );
    if (decision.status === "rejected") {
      execution.status = "rejected";
      execution.errors.push({
        code: "location_rejected",
        stage: "location",
        message: decision.reason,
      });
      return execution;
    }
    execution.materialized = validateLocation(
      execution.modelResponse.object,
      input,
      session,
    );
    execution.status = "success";
  } catch (error) {
    const timedOut =
      budget.remaining().durationMs <= 0 ||
      session.signal.reason?.name === "TimeoutError";
    if (error instanceof LocationCountryConflictError) {
      execution.errors.push({
        code: "country_conflict",
        stage: "validation",
        editionKey: error.editionKey,
        field: "countryCode",
        message: error.message,
      });
    } else {
      execution.errors.push({
        code: timedOut ? "limit_reached" : "location_failed",
        stage: "location",
        message: timedOut
          ? "Location reached the run deadline"
          : validationMessage(error),
      });
    }
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
    if (runtime && !tracing) {
      await runtime.shutdown();
    }
  }
  return execution;
}

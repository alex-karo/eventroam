import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import { DEFAULT_RESEARCH_LIMITS, type ResearchLimits } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import { RESEARCH_PROMPT_VERSION } from "./research/contracts";

const nonempty = z.string().trim().min(1).max(500);
const limitsSchema = z.object(
  Object.fromEntries(
    Object.keys(DEFAULT_RESEARCH_LIMITS).map((key) => [
      key,
      z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    ]),
  ) as Record<keyof ResearchLimits, z.ZodOptional<z.ZodNumber>>,
);
const invocationSchema = z.object({
  mode: z.enum(["add", "refresh", "check"]),
  name: nonempty.optional(),
  eventId: nonempty.optional(),
  actor: nonempty.max(200),
  initiatedBy: nonempty.max(200).optional(),
  dryRun: z.boolean().default(true),
  republish: z.boolean().default(false),
  limits: limitsSchema.optional(),
});
const configSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: nonempty.refine((value) => !value.endsWith(":online")),
  reasoningEffort: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
    .optional(),
  serviceTier: z.literal("flex").optional(),
  limits: limitsSchema,
});

/** Validation precedes persistence and context loading, including for direct callers. */
export function validateRunInvocation(
  client: Database.Database,
  input: CatalogResearchInput,
  config: ResearchConfig,
) {
  if (client.inTransaction) {
    throw new Error("Research cannot run inside a transaction");
  }
  const parsed = invocationSchema.parse(input);
  if (parsed.mode === "add") {
    if (!parsed.name || parsed.eventId) {
      throw new Error("add requires a name and no Event ID");
    }
  } else if (
    !parsed.eventId ||
    !client.prepare("SELECT id FROM events WHERE id=?").get(parsed.eventId)
  ) {
    throw new Error("Event ID not found");
  }
  return {
    input: parsed,
    config: configSchema.parse(config) as ResearchConfig,
  };
}

export type StoredRunInput = {
  mode: string;
  name?: string;
  eventId?: string;
  actor: string;
  initiatedBy?: string;
  dryRun: boolean;
  republish: boolean;
  limits: ResearchLimits;
  model: string;
  reasoningEffort: ResearchConfig["reasoningEffort"] | null;
  serviceTier: "flex" | "standard";
  promptVersion: string;
};

export function storedRunInput(
  input: CatalogResearchInput,
  config: ResearchConfig,
  limits: ResearchLimits,
): StoredRunInput {
  return {
    mode: input.mode,
    ...(input.name ? { name: input.name } : {}),
    ...(input.eventId ? { eventId: input.eventId } : {}),
    actor: input.actor,
    ...(input.initiatedBy ? { initiatedBy: input.initiatedBy } : {}),
    dryRun: input.dryRun ?? true,
    republish: input.republish ?? false,
    limits: Object.fromEntries(
      Object.keys(DEFAULT_RESEARCH_LIMITS).map((key) => [
        key,
        limits[key as keyof ResearchLimits],
      ]),
    ) as unknown as ResearchLimits,
    model: config.model,
    reasoningEffort: config.reasoningEffort ?? null,
    serviceTier: config.serviceTier ?? "standard",
    promptVersion: RESEARCH_PROMPT_VERSION,
  };
}

export class RunPersistenceError extends Error {
  public readonly report?: CatalogResearchResult;
  constructor(
    public readonly runId?: string,
    report?: CatalogResearchResult,
  ) {
    super("Ingestion run persistence failed");
    this.name = "RunPersistenceError";
    if (report) {
      try {
        this.report = JSON.parse(
          JSON.stringify(report),
        ) as CatalogResearchResult;
      } catch {
        // An unserializable model object is unavailable for output; retain other known data.
        try {
          this.report = JSON.parse(
            JSON.stringify({ ...report, modelResponse: null }),
          ) as CatalogResearchResult;
        } catch {
          // No usable report; runId still correlates the unfinished attempt.
        }
      }
    }
  }
}

const storedInputSchema = invocationSchema.extend({
  mode: nonempty,
  limits: limitsSchema.required(),
  model: nonempty,
  reasoningEffort: configSchema.shape.reasoningEffort.unwrap().nullable(),
  serviceTier: z.enum(["flex", "standard"]),
  promptVersion: nonempty,
});

export function startIngestionRun(
  client: Database.Database,
  input: StoredRunInput,
  started: number,
  eventId: string | null,
) {
  if (client.inTransaction) {
    throw new RunPersistenceError();
  }
  const runId = randomUUID();
  try {
    client
      .prepare(
        "INSERT INTO ingestion_runs(id,event_id,mode,status,started_at,input_json) VALUES(?,?,?,'running',?,?)",
      )
      .run(
        runId,
        eventId,
        input.mode,
        new Date(started).toISOString(),
        JSON.stringify(storedInputSchema.parse(input)),
      );
  } catch {
    throw new RunPersistenceError();
  }
  return runId;
}

/** Normalize once; both scalar projections and the returned report use these values. */
export function finalizeIngestionRun(
  client: Database.Database,
  runId: string,
  report: CatalogResearchResult,
  eventId: string | null,
  finished: number,
): CatalogResearchResult {
  try {
    if (client.inTransaction || report.runId !== runId) {
      throw new Error();
    }
    const json = JSON.stringify(report);
    const normalized = JSON.parse(json) as CatalogResearchResult;
    const { usage, durationMs } = normalized;
    for (const count of [usage.inputTokens, usage.outputTokens, durationMs]) {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error();
      }
    }
    // Check originals too: JSON converts nonfinite numbers into null.
    for (const cost of [
      report.usage.modelCostUsd,
      report.usage.searchCostUsd,
    ]) {
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
        throw new Error();
      }
    }
    if (
      typeof usage.complete !== "boolean" ||
      typeof usage.searchCostUsd !== "number"
    ) {
      throw new Error();
    }
    const status =
      normalized.outcome === "failed" ||
      normalized.researchStatus === "failed" ||
      hasHostFailure(normalized)
        ? "failed"
        : "completed";
    const update = client
      .prepare(
        "UPDATE ingestion_runs SET status=?,finished_at=?,event_id=?,report_json=?,input_tokens=?,output_tokens=?,model_cost_usd=?,search_cost_estimate_usd=?,duration_ms=?,usage_complete=? WHERE id=? AND status='running' AND mode=?",
      )
      .run(
        status,
        new Date(finished).toISOString(),
        eventId,
        json,
        usage.inputTokens,
        usage.outputTokens,
        usage.modelCostUsd,
        usage.searchCostUsd,
        durationMs,
        Number(usage.complete),
        runId,
        normalized.mode,
      );
    if (update.changes !== 1) {
      throw new Error();
    }
    return normalized;
  } catch {
    throw new RunPersistenceError(runId, report);
  }
}

export function hasHostFailure(result: CatalogResearchResult) {
  return result.errors.some(
    (error) =>
      error.code === "workflow_failed" ||
      error.code === "run_persistence_failed",
  );
}

/** Output diagnostics do not pretend the still-running row was finalized. */
export function persistenceFailureReport(error: RunPersistenceError) {
  return error.report
    ? {
        ...error.report,
        runId: error.runId,
        errors: [
          ...error.report.errors,
          {
            code: "run_persistence_failed" as const,
            stage: "workflow" as const,
            message: "Ingestion run persistence failed",
          },
        ],
      }
    : undefined;
}

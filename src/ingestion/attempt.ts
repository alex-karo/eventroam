import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
  IngestionData,
} from "./contracts";
import { preparationDiagnostics, readyCatalogPlan } from "./pipeline";
import { createResearchBudget, type ResearchBudget } from "./runtime/budget";
import { loadResearchConfig, type ResearchConfig } from "./runtime/config";
import { createCatalogRunTrace, type CatalogRunTrace } from "./runtime/tracing";
import { PROMPT_VERSIONS } from "./roles/versions";
import { logCompletion, reportEventId } from "./workflow-logging";
import { RunPersistenceError } from "./runs";
import type { SourceSession } from "./tools/session";
import type { Collection } from "./evidence/collection";
import {
  buildResearchReport,
  buildWorkflowFailureReport,
  type ReportInput,
} from "./report";
import {
  validateRunInvocation,
  storedRunInput,
  startIngestionRun,
  finalizeIngestionRun,
} from "./runs";

/** Owns runtime resources and terminal persistence/cleanup. */
export class CatalogAttempt {
  readonly input: CatalogResearchInput;
  readonly config: ResearchConfig;
  readonly budget: ResearchBudget;
  readonly started = Date.now();
  readonly ingestionRunId: string;
  collection: Collection | null = null;
  trace?: CatalogRunTrace;
  sources: SourceSession | null = null;
  finalization?: Promise<CatalogResearchResult>;
  private cleanupPromise?: Promise<void>;
  private active = new Set<Promise<unknown>>();

  constructor(
    readonly engineRunId: string,
    requested: CatalogResearchInput,
    readonly deps: ResearchDependencies,
    private readonly close?: () => unknown | Promise<unknown>,
  ) {
    const validated = validateRunInvocation(
      deps.client,
      requested,
      deps.config ??
        (deps.generateRole
          ? {
              apiKey: "fixture",
              model: "fixture",
              limits: createResearchBudget().limits,
            }
          : loadResearchConfig()),
    );
    this.input = validated.input;
    this.config = validated.config;
    this.budget = createResearchBudget({
      ...this.config.limits,
      ...this.input.limits,
    });
    this.ingestionRunId = startIngestionRun(
      deps.client,
      storedRunInput(this.input, this.config, this.budget.limits),
      this.started,
      this.input.mode === "add" ? null : this.input.eventId!,
    );
  }

  async initialize() {
    this.trace = await createCatalogRunTrace(
      this.input,
      this.config.model,
      this.ingestionRunId,
      [
        this.deps.client.name,
        `${this.deps.client.name}-wal`,
        `${this.deps.client.name}-shm`,
        `${this.deps.client.name}-journal`,
        ...(this.deps.reportPath ? [this.deps.reportPath] : []),
      ],
      this.engineRunId,
      this.deps.observabilityStore,
      this.deps.experimentId,
    );
    this.trace?.log?.info("Research started", {
      stage: "context",
      mode: this.input.mode,
      dryRun: this.input.dryRun,
      eventId: this.input.eventId,
      eventName: this.input.name,
      model: this.config.model,
      promptVersion: PROMPT_VERSIONS.research,
    });
  }

  reportInput(data: IngestionData): ReportInput {
    return {
      runId: this.ingestionRunId,
      ...(this.trace?.tracing.root?.traceId
        ? { traceId: this.trace.tracing.root.traceId }
        : {}),
      input: this.input,
      config: this.config,
      diagnostics: preparationDiagnostics(data),
      plan: readyCatalogPlan(data),
      outcome: data.outcome ?? "failed",
      context: data.context,
      limits: this.budget.limits,
      research: data.research,
      general: data.general,
      specialists: data.specialists,
      corpus: data.corpus,
      editor: data.editor,
      location: data.location,
      applied: data.applied,
      errors: data.errors,
      unresolved: data.unresolved,
      reads: data.reads,
      budget: this.budget.snapshot(),
      started: this.started,
      finished: Date.now(),
    };
  }

  track<T>(work: Promise<T>): Promise<T> {
    this.active.add(work);
    void work
      .finally(() => {
        this.active.delete(work);
      })
      .catch(() => {});
    return work;
  }

  async settle() {
    await Promise.allSettled([...this.active]);
  }

  fail(data: IngestionData, cancelled = false) {
    if (this.finalization || data.report) {
      return;
    }
    if (cancelled) {
      this.trace?.failed("cancelled");
    } else {
      this.trace?.failed("workflow_failed");
    }
    if (!data.applied) {
      data.outcome = "failed";
    }
    data.errors.push({
      code: "workflow_failed",
      stage: "workflow",
      message: cancelled ? "Ingestion cancelled" : "Ingestion workflow failed",
    });
    data.report = buildWorkflowFailureReport(this.reportInput(data));
  }

  /** All engine failure paths use the same settlement and terminal persistence. */
  async finalizeFailure(data: IngestionData, cancelled = false) {
    await this.settle();
    if (this.collection && !data.corpus) {
      data.corpus = await this.collection.freeze();
    }
    try {
      this.fail(data, cancelled);
    } catch {
      // Finalization records report failures.
    }
    try {
      await this.finalize(data);
    } catch {
      // Keep the engine's safe terminal error.
    }
  }

  finalize(data: IngestionData): Promise<CatalogResearchResult> {
    this.finalization ??= Promise.resolve().then(async () => {
      await this.settle();
      try {
        data.report ??= buildResearchReport(this.reportInput(data));
        const result = finalizeIngestionRun(
          this.deps.client,
          this.ingestionRunId,
          data.report,
          reportEventId(this.input, preparationDiagnostics(data), data.applied),
          Date.now(),
        );
        logCompletion(
          this.trace?.log,
          result,
          this.input,
          preparationDiagnostics(data),
        );
        return result;
      } catch (error) {
        if (data.report) {
          this.trace?.failed("run_persistence_failed");
          if (error instanceof RunPersistenceError) {
            this.trace?.log?.error("Required run finalization failed", {
              stage: "report",
              errorCode: "run_persistence_failed",
            });
          }
        } else {
          this.trace?.failed("workflow_failed");
        }
        throw error;
      } finally {
        await this.cleanup(data.report ?? undefined);
      }
    });
    return this.finalization;
  }

  async cleanup(report?: CatalogResearchResult) {
    this.cleanupPromise ??= (async () => {
      await this.settle();
      try {
        await this.trace?.finish(report);
      } catch {
        // Observability is optional; cleanup cannot replace a durable outcome.
      }
      try {
        await this.close?.();
      } catch {
        // The caller owns any acquired connection and receives no private error.
      }
    })();
    await this.cleanupPromise;
  }
}

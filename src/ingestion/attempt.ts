import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
  IngestionData,
} from "./contracts";
import { createResearchBudget, type ResearchBudget } from "./runtime/budget";
import { loadResearchConfig, type ResearchConfig } from "./runtime/config";
import { createCatalogRunTrace, type CatalogRunTrace } from "./runtime/tracing";
import { RESEARCH_PROMPT_VERSION } from "./research/contracts";
import { logCompletion, writeLogFields } from "./workflow-logging";
import { RunPersistenceError } from "./runs";
import type { SourceSession } from "./sources/session";
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
  trace?: CatalogRunTrace;
  sources: SourceSession | null = null;
  result?: CatalogResearchResult;
  persistenceError?: unknown;
  terminalError?: unknown;
  private cleanupPromise?: Promise<void>;
  private finalized = false;
  private active: Promise<unknown> | undefined;

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
        (deps.generateCandidate
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
      !!this.deps.generateCandidate,
      [
        this.deps.client.name,
        `${this.deps.client.name}-wal`,
        `${this.deps.client.name}-shm`,
        `${this.deps.client.name}-journal`,
        ...(this.deps.reportPath ? [this.deps.reportPath] : []),
      ],
      this.engineRunId,
      this.deps.observabilityStore,
    );
    this.trace?.log?.info("Research started", {
      stage: "context",
      mode: this.input.mode,
      dryRun: this.input.dryRun,
      eventId: this.input.eventId,
      eventName: this.input.name,
      model: this.config.model,
      promptVersion: RESEARCH_PROMPT_VERSION,
    });
  }

  reportInput(data: IngestionData): ReportInput {
    return {
      runId: this.ingestionRunId,
      input: this.input,
      config: this.config,
      prepared: data.prepared,
      research: data.research,
      applied: data.applied,
      writeFailed: data.writeFailed,
      errors: data.errors,
      unresolved: data.unresolved,
      reads: data.reads,
      discovery: data.discovery,
      budget: this.budget.snapshot(),
      started: this.started,
      finished: Date.now(),
    };
  }

  track<T>(work: Promise<T>): Promise<T> {
    this.active = work;
    void work
      .finally(() => {
        if (this.active === work) {
          this.active = undefined;
        }
      })
      .catch(() => {});
    return work;
  }

  async settle() {
    await this.active?.catch(() => {});
  }

  fail(data: IngestionData, cancelled = false) {
    if (this.finalized || data.report) {
      return;
    }
    if (cancelled) {
      this.trace?.terminalFailed("cancelled");
    } else {
      this.trace?.workflowFailed();
    }
    data.errors.push({
      code: "workflow_failed",
      stage: "workflow",
      message: cancelled ? "Ingestion cancelled" : "Ingestion workflow failed",
    });
    data.report = buildWorkflowFailureReport(this.reportInput(data));
  }

  async finalize(data: IngestionData) {
    if (this.finalized) {
      if (this.terminalError) {
        throw this.terminalError;
      }
      return this.result;
    }
    try {
      data.report ??= buildResearchReport(this.reportInput(data));
    } catch (error) {
      this.terminalError = error;
      this.finalized = true;
      this.trace?.workflowFailed();
      await this.cleanup(data.report ?? undefined);
      throw error;
    }
    this.finalized = true;
    try {
      let eventId = this.input.eventId ?? null;
      if (this.input.mode === "add") {
        eventId = data.prepared?.matchedEventId ?? null;
        if (!this.input.dryRun) {
          eventId ??= data.applied?.references.event ?? null;
        }
      }
      this.result = finalizeIngestionRun(
        this.deps.client,
        this.ingestionRunId,
        data.report,
        eventId,
        Date.now(),
      );
      logCompletion(
        this.trace?.log,
        this.result,
        this.input,
        data.prepared,
        data.applied,
        data.writeFailed,
      );
      return this.result;
    } catch (error) {
      this.persistenceError = error;
      this.trace?.terminalFailed("run_persistence_failed");
      if (error instanceof RunPersistenceError) {
        this.trace?.log?.error("Required run finalization failed", {
          stage: "report",
          errorCode: "run_persistence_failed",
          ...writeLogFields(this.input, data.applied, data.writeFailed),
        });
      }
      throw error;
    } finally {
      await this.cleanup(data.report ?? undefined);
    }
  }

  async cleanup(report?: CatalogResearchResult) {
    this.cleanupPromise ??= (async () => {
      await this.settle();
      try {
        await this.trace?.finish(report ?? this.result);
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

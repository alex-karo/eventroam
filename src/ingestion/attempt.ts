import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import { createResearchBudget, type ResearchBudget } from "./runtime/budget";
import { loadResearchConfig, type ResearchConfig } from "./runtime/config";
import {
  createCatalogRunTrace,
  readInitialWithTrace,
  type CatalogRunTrace,
} from "./runtime/tracing";
import { RESEARCH_PROMPT_VERSION } from "./research/contracts";
import {
  logPreparation,
  logCompletion,
  writeLogFields,
  writeDisposition,
  reportEventId,
  attemptedCatalogFields,
} from "./workflow-logging";
import { RunPersistenceError } from "./runs";
import { loadResearchContext, type ResearchContext } from "./research/context";
import { createSourceSession, type SourceSession } from "./sources/session";
import { researchFestival, type ResearchExecution } from "./research/agent";
import { prepareResearch } from "./research/prepare";
import type { ResearchError, ResearchQuestion } from "./research/contracts";
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

const emptyResearch: ResearchExecution = {
  ok: false,
  errors: [],
  usage: {
    complete: false,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: null,
    reasoningTokens: null,
    modelCostUsd: null,
  },
};

/** Private resources and full reports never enter Mastra workflow state. */
export class CatalogAttempt {
  readonly input: CatalogResearchInput;
  readonly config: ResearchConfig;
  readonly budget: ResearchBudget;
  readonly started = Date.now();
  readonly ingestionRunId: string;
  trace?: CatalogRunTrace;
  context: ResearchContext | null = null;
  sources: SourceSession | null = null;
  research: ResearchExecution = emptyResearch;
  prepared: ReturnType<typeof prepareResearch> | null = null;
  applied: ReturnType<typeof applyCatalogItem> | null = null;
  writeFailed = false;
  errors: ResearchError[] = [];
  unresolved: ResearchQuestion[] = [];
  report?: CatalogResearchResult;
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

  private reportInput(): ReportInput {
    return {
      runId: this.ingestionRunId,
      input: this.input,
      config: this.config,
      prepared: this.prepared,
      research: this.research,
      applied: this.applied,
      writeFailed: this.writeFailed,
      errors: this.errors,
      unresolved: this.unresolved,
      reads: this.sources?.reads ?? [],
      discovery: this.sources?.discovery ?? [],
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

  loadContext() {
    this.context = loadResearchContext(this.deps.client, this.input);
    this.trace?.update({ context: this.context, phase: "initial_source" });
    return this.context.knownLinks.length;
  }

  async readInitial(abortSignal?: AbortSignal) {
    abortSignal?.throwIfAborted();
    this.sources = createSourceSession(
      this.budget,
      this.config,
      this.context!.knownLinks,
      this.deps,
      this.trace?.log,
    );
    await this.track(readInitialWithTrace(this.sources, this.trace));
    abortSignal?.throwIfAborted();
    return this.sources.reads.length;
  }

  async runResearch(abortSignal: AbortSignal) {
    this.trace?.update({ phase: "research" });
    this.research = await this.track(
      researchFestival(
        this.input,
        this.context!,
        this.sources!,
        this.budget,
        this.config,
        this.deps,
        this.ingestionRunId,
        this.trace?.tracing,
        abortSignal,
      ),
    );
    return this.research.ok;
  }

  prepare() {
    this.trace?.update({ phase: "validation" });
    if (this.research.ok) {
      this.prepared = prepareResearch(
        this.research.candidate,
        this.context!.catalog,
        this.input,
        this.context!.terms,
      );
      this.trace?.validated(this.prepared);
      this.trace?.tracing.setEventId(this.prepared.matchedEventId);
      logPreparation(this.trace?.log, this.prepared);
      this.errors = this.prepared.errors;
      this.unresolved = this.prepared.unresolved;
    } else {
      this.errors = this.research.errors;
      this.trace?.failed("research_failed", false);
    }
    return this.prepared?.operations.length ?? 0;
  }

  apply(abortSignal: AbortSignal) {
    this.trace?.update({ phase: "write" });
    if (abortSignal.aborted) {
      throw new Error("Ingestion cancelled");
    }
    try {
      if (
        this.prepared?.candidate?.status !== "failed" &&
        this.prepared?.operations.length
      ) {
        if (this.trace) {
          this.trace.state.writeState = "unknown";
        }
        if (abortSignal.aborted) {
          throw new Error("Ingestion cancelled");
        }
        this.applied = applyCatalogItem(
          this.deps.client,
          this.prepared.operations,
          {
            dryRun: this.input.dryRun,
          },
        );
        if (this.trace) {
          this.trace.state.writeState = writeDisposition(
            this.input,
            this.applied,
          );
        }
        this.trace?.tracing.setEventId(
          reportEventId(this.input, this.prepared, this.applied),
        );
        this.trace?.update({ applied: this.applied });
        this.trace?.log?.info("Catalog write finished", {
          stage: "write",
          dryRun: this.input.dryRun,
          ...writeLogFields(this.input, this.applied, false),
          fields: attemptedCatalogFields(this.prepared.operations),
        });
      }
    } catch (error) {
      if (abortSignal.aborted) {
        throw error;
      }
      this.writeFailed = true;
      if (this.trace) {
        this.trace.state.writeState = "rolled_back";
      }
      this.trace?.failed("write_failed");
      this.errors.push({
        code: "write_failed",
        stage: "write",
        message: "Catalog write failed",
      });
    }
    return {
      changedCount:
        this.applied?.operations.filter((operation) => operation.changed)
          .length ?? 0,
      writeFailed: this.writeFailed,
    };
  }

  buildReport() {
    this.trace?.update({ phase: "report" });
    this.report = buildResearchReport(this.reportInput());
    return this.report.outcome;
  }

  fail(cancelled = false) {
    if (this.finalized || this.report) {
      return;
    }
    if (cancelled) {
      this.trace?.terminalFailed("cancelled");
    } else {
      this.trace?.workflowFailed();
    }
    this.errors.push({
      code: "workflow_failed",
      stage: "workflow",
      message: cancelled ? "Ingestion cancelled" : "Ingestion workflow failed",
    });
    this.report = buildWorkflowFailureReport(this.reportInput());
  }

  async finalize() {
    if (this.finalized) {
      if (this.terminalError) {
        throw this.terminalError;
      }
      return this.result;
    }
    try {
      this.report ??= buildResearchReport(this.reportInput());
    } catch (error) {
      this.terminalError = error;
      this.finalized = true;
      this.trace?.workflowFailed();
      await this.cleanup();
      throw error;
    }
    this.finalized = true;
    try {
      let eventId = this.input.eventId ?? null;
      if (this.input.mode === "add") {
        eventId = this.prepared?.matchedEventId ?? null;
        if (!this.input.dryRun) {
          eventId ??= this.applied?.references.event ?? null;
        }
      }
      this.result = finalizeIngestionRun(
        this.deps.client,
        this.ingestionRunId,
        this.report,
        eventId,
        Date.now(),
      );
      logCompletion(
        this.trace?.log,
        this.result,
        this.input,
        this.prepared,
        this.applied,
        this.writeFailed,
      );
      return this.result;
    } catch (error) {
      this.persistenceError = error;
      this.trace?.terminalFailed("run_persistence_failed");
      if (error instanceof RunPersistenceError) {
        this.trace?.log?.error("Required run finalization failed", {
          stage: "report",
          errorCode: "run_persistence_failed",
          ...writeLogFields(this.input, this.applied, this.writeFailed),
        });
      }
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    this.cleanupPromise ??= (async () => {
      await this.settle();
      try {
        await this.trace?.finish(this.report);
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

import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import {
  createCatalogRunTrace,
  readInitialWithTrace,
} from "./runtime/run-trace";
import { createResearchBudget } from "./runtime/budget";
import { loadResearchConfig } from "./runtime/config";
import { loadResearchContext } from "./research/context";
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

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

export async function runCatalogResearch(
  requested: CatalogResearchInput,
  deps: ResearchDependencies,
): Promise<CatalogResearchResult> {
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
  const { input, config } = validated;
  const budget = createResearchBudget({ ...config.limits, ...input.limits });
  const started = Date.now();
  const runId = startIngestionRun(
    deps.client,
    storedRunInput(input, config, budget.limits),
    started,
    input.mode === "add" ? null : input.eventId!,
  );
  const trace = await createCatalogRunTrace(
    input,
    config.model,
    runId,
    !!deps.generateCandidate,
  );
  let sources: SourceSession | null = null;
  let research: ResearchExecution = {
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
  let prepared: ReturnType<typeof prepareResearch> | null = null;
  let applied: ReturnType<typeof applyCatalogItem> | null = null;
  let writeFailed = false;
  let errors: ResearchError[] = [];
  let unresolved: ResearchQuestion[] = [];
  const reportInput = (): ReportInput => ({
    runId,
    input,
    config,
    prepared,
    research,
    applied,
    writeFailed,
    errors,
    unresolved,
    reads: sources?.reads ?? [],
    discovery: sources?.discovery ?? [],
    budget: budget.snapshot(),
    started,
    finished: Date.now(),
  });
  let report: CatalogResearchResult | undefined;
  try {
    try {
      const context = loadResearchContext(deps.client, input);
      trace?.update({ context, phase: "initial_source" });
      sources = createSourceSession(budget, config, context.knownLinks, deps);
      await readInitialWithTrace(sources, trace);
      trace?.update({ phase: "research" });
      research = await researchFestival(
        input,
        context,
        sources,
        budget,
        config,
        deps,
        runId,
        trace?.tracing,
      );
      trace?.update({ phase: "validation" });
      if (research.ok) {
        prepared = prepareResearch(
          research.candidate,
          context.catalog,
          input,
          context.terms,
          budget.limits.pages,
        );
        trace?.validated(prepared);
        errors = prepared.errors;
        unresolved = prepared.unresolved;
      } else {
        errors = research.errors;
        trace?.failed("research_failed", false);
      }
      trace?.update({ phase: "write" });
      try {
        if (
          prepared?.candidate?.status !== "failed" &&
          prepared?.operations.length
        ) {
          if (trace) {
            trace.state.writeState = "unknown";
          }
          applied = applyCatalogItem(deps.client, prepared.operations, {
            dryRun: input.dryRun,
          });
          if (trace) {
            trace.state.writeState = applied.operations.some(
              (operation) => operation.changed,
            )
              ? "committed"
              : "unchanged";
          }
          trace?.update({ applied });
        }
      } catch {
        writeFailed = true;
        if (trace) {
          trace.state.writeState = "rolled_back";
        }
        trace?.failed("write_failed");
        errors.push({
          code: "write_failed",
          stage: "write",
          message: "Catalog write failed",
        });
      }
      trace?.update({ phase: "report" });
      report = buildResearchReport(reportInput());
    } catch {
      trace?.workflowFailed();
      errors = [
        ...errors,
        {
          code: "workflow_failed",
          stage: "workflow",
          message: "Ingestion workflow failed",
        },
      ];
      report = buildWorkflowFailureReport(reportInput());
    }
    // Writer transactions have finished. A persistence failure must not re-enter the workflow catch.
    let persistentEventId = input.eventId ?? null;
    if (input.mode === "add") {
      persistentEventId = prepared?.matchedEventId ?? null;
      if (!input.dryRun) {
        persistentEventId ??= applied?.references.event ?? null;
      }
    }
    return finalizeIngestionRun(
      deps.client,
      runId,
      report,
      persistentEventId,
      Date.now(),
    );
  } finally {
    await trace?.finish(report);
  }
}

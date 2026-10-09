import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import { createResearchBudget, reserveTicketCall } from "./runtime/budget";
import { loadResearchConfig } from "./runtime/config";
import {
  createCatalogRunTrace,
  readInitialWithTrace,
  type CatalogRunTrace,
} from "./runtime/run-trace";
import { createResearchRuntime } from "./runtime/research-runtime";
import { loadResearchContext } from "./research/context";
import { createSourceSession, type SourceSession } from "./sources/session";
import { researchFestival, type ResearchExecution } from "./research/agent";
import { prepareResearch, preflightResearch } from "./research/prepare";
import {
  mainDraftSchema,
  type ResearchError,
  type ResearchQuestion,
} from "./research/contracts";
import { createTicketHandoff } from "./research/ticket-handoff";
import { researchTickets, skippedTickets } from "./research/ticket-agent";
import { assembleResearch } from "./research/assemble";
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
  const { input, config } = validateRunInvocation(
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
  const budget = createResearchBudget({ ...config.limits, ...input.limits });
  const started = Date.now();
  const runId = startIngestionRun(
    deps.client,
    storedRunInput(input, config, budget.limits),
    started,
    input.mode === "add" ? null : input.eventId!,
  );
  const reservation = reserveTicketCall(budget);
  let trace = await createCatalogRunTrace(
    input,
    config.model,
    runId,
    !!deps.generateCandidate,
  );
  let traceContext: ReturnType<typeof loadResearchContext> | undefined;
  let traceInitialized = !deps.generateCandidate;
  const ensureTrace = async () => {
    if (!traceInitialized) {
      traceInitialized = true;
      trace = await createCatalogRunTrace(input, config.model, runId, false);
      trace?.update({ context: traceContext, phase: "tickets" });
    }
    return trace?.tracing;
  };
  const runtime = createResearchRuntime(
    input,
    config.model,
    runId,
    ensureTrace,
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
  let ticket = skippedTickets();
  let sourceSummaries: ReportInput["sourceSummaries"];
  let applied: ReturnType<typeof applyCatalogItem> | null = null;
  let writeFailed = false;
  let errors: ResearchError[] = [];
  let unresolved: ResearchQuestion[] = [];
  const reportInput = (): ReportInput => ({
    runId,
    input,
    config,
    prepared,
    ticket,
    sourceSummaries,
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
  let workflowFailed = false;
  const recordWorkflowFailure = () => {
    workflowFailed = true;
    trace?.workflowFailed();
    errors = [
      ...errors,
      {
        code: "workflow_failed",
        stage: "workflow",
        message: "Ingestion workflow failed",
      },
    ];
  };
  let report: CatalogResearchResult | undefined;
  try {
    try {
      const context = loadResearchContext(deps.client, input);
      traceContext = context;
      trace?.update({ context, phase: "initial_source" });
      sources = createSourceSession(
        reservation.main,
        config,
        context.knownLinks,
        deps,
      );
      await readInitialWithTrace(sources, trace);
      trace?.update({ phase: "research" });
      research = await researchFestival(
        input,
        context,
        sources,
        reservation.main,
        config,
        deps,
        runtime,
      );
      const stages = await prepareStages(
        research,
        input,
        context,
        sources.reads,
        budget,
        config,
        deps,
        runtime,
        reservation.release,
        trace,
      );
      ({ ticket, errors, unresolved } = stages);
      sourceSummaries =
        "sourceSummaries" in stages ? stages.sourceSummaries : undefined;
      trace?.update({ phase: "validation" });
      prepared = stages.candidate
        ? prepareResearch(
            stages.candidate,
            context.catalog,
            input,
            context.terms,
            budget.limits.pages,
          )
        : null;
      observePreparedResearch(
        trace,
        prepared,
        research,
        stages.targetValidation,
      );
      errors = [...(prepared?.errors ?? []), ...errors];
      unresolved = prepared?.unresolved ?? unresolved;
      trace?.update({ phase: "write" });
      try {
        if (
          prepared?.candidate?.status !== "failed" &&
          prepared?.operations.length
        ) {
          trace?.beginWrite();
          applied = applyCatalogItem(deps.client, prepared.operations, {
            dryRun: input.dryRun,
          });
          trace?.written(applied);
        }
      } catch {
        writeFailed = true;
        trace?.rolledBack();
        errors.push({
          code: "write_failed",
          stage: "write",
          message: "Catalog write failed",
        });
      }
    } catch {
      recordWorkflowFailure();
    }
    trace?.update({ phase: "report" });
    try {
      report = workflowFailed
        ? buildWorkflowFailureReport(reportInput())
        : buildResearchReport(reportInput());
    } catch {
      if (!workflowFailed) {
        recordWorkflowFailure();
      }
      report = buildWorkflowFailureReport(reportInput());
    }
  } finally {
    reservation.release();
    await runtime.finish();
    await trace?.finish(report);
  }
  report.durationMs = Date.now() - started;
  // Persistence failures must not re-enter the workflow catch or retain transient preview IDs.
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
}

async function prepareStages(
  research: import("./research/agent").ResearchExecution,
  input: CatalogResearchInput,
  context: ReturnType<typeof loadResearchContext>,
  reads: import("./sources/contracts").ReadSourceResult[],
  budget: import("./runtime/budget").ResearchBudget,
  config: import("./runtime/config").ResearchConfig,
  deps: ResearchDependencies,
  runtime: ReturnType<typeof createResearchRuntime>,
  release: () => void,
  trace?: CatalogRunTrace,
) {
  const ticketSkipped = skippedTickets();
  const rejected = (
    errors: ResearchError[],
    targetValidation: "passed" | "failed" | "not_run" = "not_run",
  ) => ({
    targetValidation,
    candidate: null,
    ticket: ticketSkipped,
    errors,
    unresolved: [] as ResearchQuestion[],
  });
  const invalid = (message: string) =>
    rejected([{ code: "invalid_candidate", stage: "validation", message }]);
  if (!research.ok) {
    return rejected(research.errors);
  }
  const parsed = mainDraftSchema.safeParse(research.candidate);
  if (!parsed.success) {
    return invalid("Main research draft is invalid");
  }
  const main = parsed.data;
  const target = main.data
    ? preflightResearch(main.data, context.catalog, input, budget.limits.pages)
    : null;
  if (target?.error) {
    return rejected(
      [
        {
          code: "invalid_candidate",
          stage: "validation",
          message: target.error,
        },
      ],
      target.targetValidation,
    );
  }
  let ticket = ticketSkipped;
  if (main.data && !target?.skipped) {
    let handoff;
    try {
      handoff = createTicketHandoff(
        main.data,
        target?.event,
        reads,
        budget,
        deps.todayUtc,
      );
    } catch {
      return invalid("Main ticket routing contains an unread source");
    }
    release();
    trace?.update({ phase: "tickets" });
    ticket = await researchTickets(handoff, budget, config, deps, runtime);
  } else {
    release();
  }
  const assembled = assembleResearch(main, ticket);
  return {
    targetValidation: target?.targetValidation ?? "not_run",
    candidate: assembled.candidate,
    ticket,
    errors: assembled.errors,
    unresolved: assembled.candidate?.unresolved ?? main.unresolved,
    sourceSummaries: main.data?.sources ?? [],
  };
}

function observePreparedResearch(
  trace: CatalogRunTrace | undefined,
  prepared: ReturnType<typeof prepareResearch> | null,
  research: ResearchExecution,
  targetValidation: "passed" | "failed" | "not_run",
) {
  if (!trace) {
    return;
  }
  if (prepared) {
    trace.validated(prepared);
  } else if (research.ok) {
    trace.state.structuralValidation = mainDraftSchema.safeParse(
      research.candidate,
    ).success
      ? "passed"
      : "failed";
    trace.state.targetValidation = targetValidation;
    trace.failed("validation_failed");
  } else {
    trace.failed("research_failed", false);
  }
}

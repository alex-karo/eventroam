import { expect, test } from "vitest";
import { createIngestionData } from "./contracts";
import type { Source } from "./evidence/contracts";
import { buildResearchReport, type ReportRun } from "./report";
import { buildAssignment } from "./roles/assignment";
import { createResearchBudget } from "./runtime/budget";
import { initialDiagnostics } from "./stage";
import { persistenceFailureReport, RunPersistenceError } from "./runs";
import type { InputDuplicateMatch } from "./research/input-duplicate";

function reportInput() {
  const data = createIngestionData();
  const budget = createResearchBudget({}, () => 0);
  data.context = {
    catalog: [],
    terms: [],
    knownLinks: [],
    currentDate: "2028-01-01T12:00:00.000Z",
  };
  data.outcome = "unchanged";
  const run: ReportRun = {
    runId: "test-run",
    input: { mode: "add", input: "Example Fest, us", actor: "test" },
    config: { model: "fixture" },
    limits: budget.limits,
    repairs: [],
    budget: budget.snapshot(),
    started: 0,
    finished: 1,
  };
  return { data, run };
}

function earlyReportInput(support: InputDuplicateMatch["support"]) {
  const { data, run } = reportInput();
  data.context!.inputDuplicate = {
    eventId: "fest",
    matchedName: "Example Fest",
    support,
  };
  const diagnostics = {
    ...initialDiagnostics(),
    matchedEventId: "fest",
    validation: { structural: "passed", target: "not_run" } as const,
  };
  data.researchValidation = { status: "skip", diagnostics };
  data.outcome = "skipped";
  return { data, diagnostics, run };
}

function source(id: string, overview: string): Source {
  const url = `https://example.com/${id}`;
  return {
    id,
    processing: "complete",
    status: "ok",
    method: "http",
    attemptedUrl: url,
    finalUrl: url,
    retrievedAt: "2027-01-01T00:00:00Z",
    overview,
    limitations: [],
  };
}

test.each([{ countryCode: "US" }, { officialUrl: "https://example.com/" }])(
  "reports a successful source-free skip with support %j",
  (support) => {
    const { data, run } = earlyReportInput(support);
    const report = buildResearchReport(data, run);
    expect(report).toMatchObject({
      schemaVersion: 8,
      outcome: "skipped",
      researchStatus: "success",
      eventId: "fest",
      inputDuplicate: { eventId: "fest", matchedName: "Example Fest", support },
      sources: [],
      sourceSummaries: [],
      operations: [],
      receipts: [],
      references: {},
      changes: [],
      errors: [],
      unresolved: [],
      modelResponse: null,
      classificationResponse: null,
      editorResponse: null,
      locationResponse: null,
      editorStatus: "not_run",
      locationStatus: "not_run",
      budget: { pages: 0, searches: 0, modelCalls: 0 },
    });
    expect(report).not.toHaveProperty("workload");
  },
);

test("compacts successful replies even when the run fails", () => {
  const { data, run } = reportInput();
  const modelResponse = { text: "Provider reply", object: { value: 1 } };
  data.outcome = "failed";
  data.general = { ...data.general, status: "success", modelResponse };
  data.specialists.classification = data.general;
  data.editor = {
    ...data.editor,
    status: "failed",
    modelResponse,
    responseStatus: "success",
  };
  data.location = { ...data.location, status: "success", modelResponse };

  const report = buildResearchReport(data, run);
  expect(report.editorStatus).toBe("failed");
  const { object } = modelResponse;
  for (const reply of [
    report.modelResponse,
    report.classificationResponse,
    report.editorResponse,
    report.locationResponse,
  ]) {
    expect(reply).toEqual({ object });
  }
  expect(data.general.modelResponse).toEqual(modelResponse);
});

test("keeps reply text for failed, rejected and recovered execution", () => {
  const { data, run } = reportInput();
  const modelResponse = { text: "Invalid provider reply", object: {} };
  data.general = { ...data.general, status: "failed", modelResponse };
  data.specialists.classification = {
    ...data.general,
    status: "success",
    responseFailed: true,
  };
  data.editor = { ...data.editor, status: "failed", modelResponse };
  data.location = { ...data.location, status: "rejected", modelResponse };

  const report = buildResearchReport(data, run);
  for (const reply of [
    report.modelResponse,
    report.classificationResponse,
    report.editorResponse,
    report.locationResponse,
  ]) {
    expect(reply).toEqual(modelResponse);
  }
});

test.each(["outcome", "mode", "workflow_error", "different_event", "no_match"])(
  "an early match does not override %s",
  (failure) => {
    const { data, diagnostics, run } = earlyReportInput({ countryCode: "US" });
    if (failure === "outcome") {
      data.outcome = "failed";
    }
    if (failure === "mode") {
      run.input.mode = "refresh";
    }
    if (failure === "workflow_error") {
      data.errors.push({
        code: "workflow_failed",
        stage: "workflow",
        message: "Failed",
      });
    }
    if (failure === "different_event") {
      diagnostics.matchedEventId = "other";
    }
    if (failure === "no_match") {
      delete data.context!.inputDuplicate;
    }
    const report = buildResearchReport(data, run);
    expect(report.researchStatus).toBe("failed");
    expect(report).not.toHaveProperty("inputDuplicate");
  },
);

test("a failed persistence response cannot retain the successful early-match marker", () => {
  const { data, run } = earlyReportInput({ countryCode: "US" });
  const report = buildResearchReport(data, run);
  const failed = persistenceFailureReport(
    new RunPersistenceError(run.runId, report),
  );
  expect(failed).not.toHaveProperty("inputDuplicate");
  expect(failed?.errors).toContainEqual({
    code: "run_persistence_failed",
    stage: "workflow",
    message: "Ingestion run persistence failed",
  });
});

test("an earlier withdrawal cannot settle the question after a later failed repair", () => {
  const { data, run } = earlyReportInput({ countryCode: "US" });
  data.outcome = "unchanged";
  const path = "currentOrNextEdition.fields.sizeEstimate";
  const question = { field: path, message: "No supported estimate." };
  const earlier = {
    path,
    owner: "general" as const,
    target: { eventId: "fest", editionKey: "2027" },
    trigger: "editor" as const,
    note: "Verify the estimate.",
    original: null,
    revision: null,
    omissionReason: question.message,
    decision: {
      path,
      decision: "approve" as const,
      note: "Preserve the saved value.",
    },
  };
  data.unresolved = [question];
  run.repairs = [
    earlier,
    {
      ...earlier,
      omissionReason: undefined,
      failure: {
        code: "invalid_candidate",
        stage: "validation",
        message: "The revision has no reason for its omission.",
      },
      decision: {
        path,
        decision: "reject",
        note: "The last revision was invalid.",
      },
    },
  ];
  const report = buildResearchReport(data, run);
  expect(report.repairs).toEqual(run.repairs);
  expect(report.unresolved).toEqual([
    question,
    {
      field: path,
      editionKey: "2027",
      message: "The revision has no reason for its omission.",
    },
  ]);
});

test("source summaries contain only nonempty Reader overviews", () => {
  const { data, run } = reportInput();
  const travel = source("travel", "Travel guide.");
  const tickets = source("tickets", "Ticket guide.");
  data.corpus = {
    version: "fixture",
    sources: [travel, tickets, source("index", "")],
    evidence: [],
  };
  data.research = {
    ...data.research,
    status: "success",
    output: {
      checks: [
        {
          check: "currentLocation",
          sourceIds: [travel.id],
          blocker: "The directions page is unavailable.",
        },
        { check: "currentTickets", sourceIds: [tickets.id], blocker: null },
      ],
      unresolved: [],
    },
  };
  data.specialists = {
    tickets: {
      ...data.research,
      output: {
        checks: [
          {
            check: "currentTickets",
            sourceIds: [tickets.id],
            finding: "verified",
            explanation: "Tickets start at €25.",
          },
        ],
      },
    },
  };

  expect(buildResearchReport(data, run).sourceSummaries).toEqual([
    {
      url: travel.finalUrl,
      information: "Travel guide.",
    },
    {
      url: tickets.finalUrl,
      information: "Ticket guide.",
    },
  ]);
});

test("a source with limited processing makes research partial", () => {
  const { data, run } = reportInput();
  const complete = source("programme", "Dates and tickets.");
  const limited: Source = {
    ...source("travel", "Travel guide."),
    processing: "limited",
    limitations: ["The page content was cut short."],
  };
  const quote = "The festival runs from July 1 to 3.";
  data.research = {
    ...data.research,
    status: "success",
    output: {
      checks: buildAssignment(run.input, data.context!).checks.map(
        ({ key }) => ({ check: key, sourceIds: [complete.id], blocker: null }),
      ),
      unresolved: [],
    },
  };
  data.corpus = {
    version: "fixture",
    sources: [complete],
    evidence: [
      {
        id: "programme-e1",
        sourceId: complete.id,
        quote,
        span: { start: 0, end: quote.length },
        context: [],
        anchors: [],
        topics: ["dates"],
        editionClues: [],
        uncertainty: null,
      },
    ],
  };

  expect(buildResearchReport(data, run).researchStatus).toBe("success");

  data.corpus.sources.push(limited);
  expect(buildResearchReport(data, run).researchStatus).toBe("partial");
});

import { expect, test } from "vitest";
import { createIngestionData } from "./contracts";
import { buildResearchReport, type ReportInput } from "./report";
import { createResearchBudget } from "./runtime/budget";
import { initialDiagnostics } from "./stage";
import { persistenceFailureReport, RunPersistenceError } from "./runs";
import type { InputDuplicateMatch } from "./research/input-duplicate";

function earlyReportInput(
  support: InputDuplicateMatch["support"],
): ReportInput {
  const state = createIngestionData();
  const budget = createResearchBudget({}, () => 0);
  return {
    ...state,
    runId: "early-run",
    input: { mode: "add", input: "Example Fest, us", actor: "test" },
    config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
    context: {
      catalog: [],
      terms: [],
      knownLinks: [],
      currentDate: "2028-01-01T12:00:00.000Z",
      inputDuplicate: { eventId: "fest", matchedName: "Example Fest", support },
    },
    diagnostics: {
      ...initialDiagnostics(),
      matchedEventId: "fest",
      validation: { structural: "passed", target: "not_run" },
    },
    plan: null,
    outcome: "skipped",
    limits: budget.limits,
    budget: budget.snapshot(),
    started: 0,
    finished: 1,
  };
}

test.each([{ countryCode: "US" }, { officialUrl: "https://example.com/" }])(
  "reports a successful source-free skip with support %j",
  (support) => {
    const input = earlyReportInput(support);
    const report = buildResearchReport(input);
    expect(report).toMatchObject({
      schemaVersion: 7,
      outcome: "skipped",
      researchStatus: "success",
      eventId: "fest",
      inputDuplicate: { eventId: "fest", matchedName: "Example Fest", support },
      workload: { savedEditions: 0, returnedEditions: 0 },
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
  },
);

test.each(["outcome", "mode", "workflow_error", "different_event", "no_match"])(
  "an early match does not override %s",
  (failure) => {
    const input = earlyReportInput({ countryCode: "US" });
    if (failure === "outcome") {
      input.outcome = "failed";
    }
    if (failure === "mode") {
      input.input.mode = "refresh";
    }
    if (failure === "workflow_error") {
      input.errors.push({
        code: "workflow_failed",
        stage: "workflow",
        message: "Failed",
      });
    }
    if (failure === "different_event") {
      input.diagnostics!.matchedEventId = "other";
    }
    if (failure === "no_match") {
      delete input.context!.inputDuplicate;
    }
    const report = buildResearchReport(input);
    expect(report.researchStatus).toBe("failed");
    expect(report).not.toHaveProperty("inputDuplicate");
  },
);

test("a failed persistence response cannot retain the successful early-match marker", () => {
  const report = buildResearchReport(earlyReportInput({ countryCode: "US" }));
  const failed = persistenceFailureReport(
    new RunPersistenceError("early-run", report),
  );
  expect(failed).not.toHaveProperty("inputDuplicate");
  expect(failed?.errors).toContainEqual({
    code: "run_persistence_failed",
    stage: "workflow",
    message: "Ingestion run persistence failed",
  });
});

test("an earlier withdrawal cannot settle the question after a later failed repair", () => {
  const input = earlyReportInput({ countryCode: "US" });
  input.outcome = "unchanged";
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
  input.unresolved = [question];
  input.repairs = [
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
  expect(buildResearchReport(input).unresolved).toEqual([
    question,
    {
      field: path,
      editionKey: "2027",
      message: "The revision has no reason for its omission.",
    },
  ]);
});

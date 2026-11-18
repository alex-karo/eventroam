import { expect, test } from "vitest";
import { createIngestionData, type CatalogResearchResult } from "../contracts";
import { buildResearchReport } from "../report";
import { createResearchBudget } from "../runtime/budget";
import { loadEvalSuite } from "./fixtures";
import { scoreCase } from "./score";

const suite = loadEvalSuite();
function scenario(id: string) {
  const item = suite.cases.find((item) => item.id === id);
  if (!item || item.suite !== "regression" || item.location) {
    throw new Error(`Missing pipeline regression ${id}`);
  }
  const budget = createResearchBudget();
  const report: CatalogResearchResult = {
    ...buildResearchReport({
      ...createIngestionData(),
      runId: "fixture",
      input: item.input,
      diagnostics: null,
      plan: null,
      outcome: "updated",
      config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
      limits: budget.limits,
      budget: budget.snapshot(),
      started: 0,
      finished: 1,
    }),
    researchStatus: "success",
    editorStatus: "success",
    editorResponse: {
      text: null,
      object: {
        decisions: ["item", "event.target"].map((path) => ({
          path,
          decision: "approve",
          note: "Supported target",
        })),
      },
    },
  };
  const change = (
    field: string,
    newValue: unknown,
    subject = item.initial.event.id,
  ) => ({ subject, field, newValue, oldValue: null, explanations: [] });
  return {
    item,
    report,
    change,
    score: (overrides: Partial<CatalogResearchResult> = {}) =>
      scoreCase(item, { ...report, ...overrides }, []),
  };
}

test("captured scoring uses the completed result after a live or cancelled return", () => {
  const { item, report, score, change } = scenario("editor-valid-update");
  const eventId = item.initial.event.id;
  const edition = "new-edition";
  report.operations = [
    {
      kind: "createEdition",
      operationKey: "edition",
      actor: "test",
      eventId,
      tempKey: "edition",
      data: { editionKey: "2027", editionYear: 2027 },
    },
  ];
  report.references = { edition };
  const address = change(
    "venue_address",
    "Május 9. park, Budapest, 1033",
    edition,
  );
  report.changes = [
    change("links", [
      { kind: "official_site", url: "https://szigetfestival.com/en/" },
    ]),
    change("starts_on", "2027-08-10", edition),
    change("ends_on", "2027-08-14", edition),
    change("date_state", "confirmed", edition),
    address,
  ];
  const approve = { decision: "approve", note: "Supported" };
  const returnLocation = { decision: "return", note: "Check the saved place." };
  report.editorResponse = {
    text: null,
    object: {
      decisions: [
        { path: "item", ...approve },
        { path: "event.target", ...approve },
        {
          path: "previousEdition.target",
          decision: "reject",
          note: "Wrong Edition",
        },
        { path: "previousEdition.fields.location", ...returnLocation },
        { path: "currentOrNextEdition.fields.location", ...returnLocation },
      ],
    },
  };
  report.repairs = [
    {
      path: "currentOrNextEdition.fields.location",
      trigger: "editor",
      owner: "location",
      target: { eventId, editionKey: "2027" },
      note: returnLocation.note,
      original: null,
      decision: {
        path: "currentOrNextEdition.fields.location",
        ...approve,
        decision: "approve",
      },
    },
  ];
  expect(score().passed).toBe(true);
  expect(score({ editorStatus: "failed" }).passed).toBe(false);
  expect(
    score({ editorResponse: { text: null, object: { decisions: {} } } }).passed,
  ).toBe(false);
  expect(score({ outcome: "failed" }).passed).toBe(false);
  expect(
    score({ changes: report.changes.filter((entry) => entry !== address) })
      .checks,
  ).toContainEqual(
    expect.objectContaining({
      path: "catalog.edition.2027.venue_address",
      passed: false,
    }),
  );
});

test("captured source refusal can pass without Editor", () => {
  const { score, item } = scenario("editor-unavailable");
  const { attemptedUrl, finalUrl, retrievedAt } = item.sources[0];
  expect(
    score({
      outcome: "failed",
      researchStatus: "failed",
      editorStatus: "not_run",
      editorResponse: null,
      sources: [{ attemptedUrl, finalUrl, retrievedAt, outcome: "failed" }],
      errors: [
        {
          code: "source_unavailable",
          stage: "source",
          url: attemptedUrl,
          message: "Source is unavailable.",
        },
      ],
    }).passed,
  ).toBe(true);
});

test("checks approved regular features and blocked promises separately", () => {
  const { item, score, change } = scenario("editor-description-context");
  const proposal = item.roleHandoff!.roles.classification!;
  if (
    proposal.description?.action !== "set" ||
    proposal.shortDescription?.action !== "set"
  ) {
    throw new Error("Expected two submitted description values");
  }
  const supported = change("description", proposal.description.value);
  const invented = change("short_description", proposal.shortDescription.value);
  expect(score({ changes: [supported] }).passed).toBe(true);
  expect(score({ changes: [] }).passed).toBe(false);
  expect(score({ changes: [supported, invented] }).passed).toBe(false);
});

test("description scoring uses changed Event text after review", () => {
  const { report, score, change } = scenario("description-announced-move");
  report.classificationResponse = {
    text: null,
    object: {
      description: { action: "set", value: "A forest music festival." },
    },
  };
  const description = change(
    "description",
    "Music and art fill a city square.",
  );
  const short = change(
    "short_description",
    "An urban music and arts festival.",
  );
  expect(score({ changes: [description, short] }).passed).toBe(true);
  for (const newValue of ["A forest festival with camping.", " ", null]) {
    expect(
      score({ changes: [description, { ...short, newValue }] }).passed,
    ).toBe(false);
  }
  expect(
    score({ changes: [description, { ...short, subject: "other-event" }] })
      .passed,
  ).toBe(false);
});

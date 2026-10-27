import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as database from "@/db/connection";
import * as workflow from "../workflow";
import { fixtureLocationPlan, generateFixtureEditor } from "@/test/ingestion";
import {
  loadEvalSuite,
  pipelineEvalCaseSchema,
  type LocationEvalCase,
} from "./fixtures";
import { fixedGeocoding, runCatalogEvals, evalItemPassed } from "./run";
import { scoreLocationCase } from "./score";
import { readSavedResults } from "@/test/eval-storage";
import { resolveLocation } from "../location/agent";
import { createResearchBudget } from "../runtime/budget";
import { LOCATION_PROMPT_VERSION } from "../location/contracts";
import type { LocationInput } from "../location/input";
import type { RegisteredPoint } from "../location/contracts";
import { locationDecision } from "@/test/eval-location";
type Prompt = LocationInput & { points: RegisteredPoint[] };
import { executeCatalogEvalCommand } from "../../../commands/catalog-eval";
const suite = loadEvalSuite();
const cases = suite.cases.filter(
  (item): item is LocationEvalCase => !!item.location,
);
const config = {
  apiKey: "fixture",
  model: "fixture/model",
  limits: createResearchBudget().limits,
};
let evalDirectory: string;
beforeEach(() => {
  evalDirectory = mkdtempSync(join(tmpdir(), "eventroam-location-store-"));
  vi.stubEnv("CATALOG_EVAL_DATABASE_PATH", join(evalDirectory, "evals.sqlite"));
});
afterEach(() => {
  rmSync(evalDirectory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
for (const item of cases) {
  test(`${item.id} exercises real preparation, point validation and scoring`, async () => {
    const execution = await resolveLocation(
      item.location.input,
      createResearchBudget(),
      config,
      {
        geocodingClient: fixedGeocoding(item),
        generateLocation: (prompt, context) =>
          locationDecision(item, JSON.parse(prompt), context.geocode),
      },
    );
    expect(execution.status).toBe("success");
    expect(scoreLocationCase(item, execution).passed).toBe(true);
    if (item.id === "location-official-venue-point") {
      const source = execution.points.find((point) => point.kind === "source")!;
      expect(source.comparisons![0].targetKm).toBeGreaterThan(10);
      expect(source.comparisons![0].donorKm).toBeGreaterThan(10);
      expect(
        execution.observations.every(({ origin }) => origin === "initial"),
      ).toBe(true);
      const missingQuestion = structuredClone(execution);
      missingQuestion.materialized!.unresolved = [];
      expect(scoreLocationCase(item, missingQuestion).passed).toBe(false);
    }
    if (
      ["location-move-city-fallback", "location-move-without-point"].includes(
        item.id,
      )
    ) {
      const oldVenue = structuredClone(execution);
      oldVenue.materialized!.slots.currentOrNextEdition!.venueName = {
        action: "keep",
        reason: "Preserve the saved venue name",
      };
      const score = scoreLocationCase(item, oldVenue);
      expect(score.passed).toBe(false);
      expect(
        score.required
          .filter((check) => !check.matched)
          .map((check) => check.assertion.field),
      ).toEqual(["venue_name"]);
    }
    if (item.id === "location-cemetery") {
      for (const unresolved of [
        [],
        [
          {
            editionKey: "another-edition",
            field: "coordinates",
            message: "Unknown point",
          },
        ],
        [
          {
            editionKey: item.location.input.currentOrNextEdition!.editionKey,
            field: "tickets",
            message: "Unknown tickets",
          },
        ],
      ]) {
        const missingQuestion = structuredClone(execution);
        missingQuestion.materialized!.unresolved = unresolved;
        const score = scoreLocationCase(item, missingQuestion);
        expect(score.passed).toBe(false);
        expect(
          score.required
            .filter((check) => !check.matched)
            .map((check) => check.assertion.field),
        ).toEqual(["unresolved"]);
      }
    }
    const keep = await resolveLocation(
      item.location.input,
      createResearchBudget(),
      config,
      {
        geocodingClient: fixedGeocoding(item),
        generateLocation: async (prompt) =>
          fixtureLocationPlan(JSON.parse(prompt)),
      },
    );
    expect(scoreLocationCase(item, keep).passed).toBe(
      item.location.group === "preservation",
    );
  });
}
function mockLocation(extraQuery = false) {
  return vi
    .spyOn(Agent.prototype, "generate")
    .mockImplementation(async function (this: Agent, raw: unknown) {
      expect(this.id).toBe("festival-location");
      const prompt = JSON.parse(raw as string) as Prompt;
      const item = cases.find(
        (item) => item.location.input.festival.name === prompt.festival.name,
      )!;
      const tools = await this.listTools();
      const geocode = async (query: {
        query: string;
        countryCode: string | null;
      }) =>
        "execute" in tools.geocode
          ? tools.geocode.execute!(query, {} as never)
          : Promise.reject(new Error("Missing geocode tool"));
      if (extraQuery) {
        await geocode({
          query: "Not in the captured fixture",
          countryCode: prompt.countryBaseline,
        });
      }
      return {
        text: "",
        object: await locationDecision(item, prompt, geocode),
      } as never;
    });
}
test("location-only uses no database or workflow and retains native items, groups and repetitions", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubEnv("CATALOG_LOCATION_MODEL", "fixture/environment-model");
  vi.spyOn(database, "openDatabase").mockImplementation(() => {
    throw new Error("Database is forbidden");
  });
  vi.spyOn(workflow, "runCatalogResearch").mockImplementation(async () => {
    throw new Error("Workflow is forbidden");
  });
  const model = mockLocation();
  const selected = cases.filter(
    (item) => item.location.group === "preservation",
  );
  const report = await runCatalogEvals({
    locationOnly: true,
    model: "fixture/selected-model",
    suite: { ...suite, cases: selected },
    repeat: 2,
  });
  expect(model).toHaveBeenCalledTimes(selected.length * 2);
  expect(report.groups[0].metadata.models.research).toBe(
    "fixture/selected-model",
  );
  expect(report.groups[0].metadata.models.location).toBe(
    "fixture/selected-model",
  );
  expect(report.groups[0].metadata.promptVersions.location).toBe(
    LOCATION_PROMPT_VERSION,
  );
  expect(report.groups[0].results.every(evalItemPassed)).toBe(true);
  expect(
    report.groups[0].results.every(
      (item) =>
        !item.output?.report &&
        item.output?.location?.observations.length &&
        item.output.runId,
    ),
  ).toBe(true);
  expect(
    report.groups[0].results.every(
      (item) => item.locationGroup === "preservation",
    ),
  ).toBe(true);
  expect(database.openDatabase).not.toHaveBeenCalled();
  expect(workflow.runCatalogResearch).not.toHaveBeenCalled();
});
test.each(["initial", "agent"])(
  "%s fixture misses fail after valid output and save siblings before nonzero exit",
  async (origin) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture");
    const selected = structuredClone(
      cases
        .filter((item) => item.location.group === "preservation")
        .slice(0, 2),
    );
    if (origin === "initial") {
      selected[0].geocoding = [];
    }
    const model = mockLocation(origin === "agent");
    const runs: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
    const code = await executeCatalogEvalCommand(["--location-only"], {
      stdout: vi.fn(),
      runEvals: async (options) => {
        const run = await runCatalogEvals({
          ...options,
          suite: { ...suite, cases: selected },
        });
        runs.push(run);
        return run;
      },
    });
    expect(code).toBe(1);
    expect(model).toHaveBeenCalledTimes(2);
    const report = runs[0];
    expect((await readSavedResults(report.groups[0])).results).toHaveLength(2);
    expect(report.groups[0].results).toHaveLength(2);
    const failed = report.groups[0].results.find(
      (item) => item.caseId === selected[0].id,
    )!;
    const sibling = report.groups[0].results.find(
      (item) => item.caseId === selected[1].id,
    )!;
    expect(failed.output!.location!.status).toBe("success");
    expect(failed.output!.score!.diagnostics.execution).toEqual([
      "Unmatched geocoding fixture: fixture_miss",
    ]);
    expect(sibling.output!.location!.status).toBe("success");
    if (origin === "initial") {
      expect(sibling.output!.score!.passed).toBe(true);
    }
  },
);
test("exclusive modes reject before setup and missing required native scores fail", async () => {
  const model = mockLocation();
  await expect(
    runCatalogEvals({ locationOnly: true, editorOnly: true }),
  ).rejects.toThrow("Use one of");
  expect(model).not.toHaveBeenCalled();
  expect(
    evalItemPassed({ output: { score: { passed: true } }, scores: [] }),
  ).toBe(false);
});
test.each([false, true])(
  "location-only retains the rejection reason with fixture miss: %s",
  async (missingFixture) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture");
    const reason = "The venue belongs to another festival";
    vi.spyOn(Agent.prototype, "generate").mockResolvedValue({
      text: "",
      object: { decision: { status: "rejected", reason } },
    } as never);
    const fixture = structuredClone(cases[0]);
    if (missingFixture) {
      fixture.geocoding = [];
    }
    const report = await runCatalogEvals({
      locationOnly: true,
      suite: { ...suite, cases: [fixture] },
    });
    const item = report.groups[0].results[0];
    expect(item.output?.location).toMatchObject({
      status: "rejected",
      materialized: null,
      errors: [
        { code: "location_rejected", stage: "location", message: reason },
      ],
    });
    expect(item.output?.score?.diagnostics.execution).toEqual(
      missingFixture
        ? [reason, "Unmatched geocoding fixture: fixture_miss"]
        : [reason],
    );
    expect(evalItemPassed(item)).toBe(false);
  },
);

test("recorded empty responses and provider failures differ from fixture misses", async () => {
  const item = structuredClone(
    cases.find((item) => item.location.group === "preservation")!,
  );
  for (const outcome of ["empty", "error"]) {
    item.geocoding!.forEach((fixture) => {
      fixture.response =
        outcome === "error"
          ? { status: "error", code: "provider_error" }
          : fixture.request.direction === "forward"
            ? { status: "success", direction: "forward", candidates: [] }
            : {
                status: "success",
                direction: "reverse",
                queriedPoint: {
                  latitude: fixture.request.latitude,
                  longitude: fixture.request.longitude,
                },
                nearby: null,
                distanceKm: null,
              };
    });
    const execution = await resolveLocation(
      item.location.input,
      createResearchBudget(),
      config,
      {
        geocodingClient: fixedGeocoding(item),
        generateLocation: async (prompt) =>
          fixtureLocationPlan(JSON.parse(prompt)),
      },
    );
    expect(scoreLocationCase(item, execution).passed).toBe(true);
    expect(
      execution.observations.every(
        (observation) =>
          observation.result.status !== "error" ||
          observation.result.code !== "fixture_miss",
      ),
    ).toBe(true);
  }
});

test("pipeline eval uses shared geocoding recordings to select a point", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  const item = cases.find((item) => item.id === "location-building-complex")!;
  const { location, ...rest } = item;
  const pipeline = pipelineEvalCaseSchema.parse(rest);
  const target = location!.input.currentOrNextEdition!;
  pipeline.expectations = {
    required: Object.entries({
      latitude: 42.5933469,
      longitude: -5.5835976,
      coordinate_precision: "approximate",
    }).map(([field, value]) => ({
      owner: "edition",
      editionKey: target.editionKey,
      field,
      value,
    })),
    forbidden: [
      {
        owner: "edition",
        editionKey: target.editionKey,
        field: "coordinate_precision",
        value: "exact",
      },
    ],
  };
  const executeResearch = workflow.runCatalogResearch;
  vi.spyOn(workflow, "runCatalogResearch").mockImplementation((input, deps) =>
    executeResearch(input, {
      ...deps,
      generateCandidate: async () => ({
        status: "success",
        data: {
          eventId: pipeline.initial.event.id,
          eventName: pipeline.initial.event.canonicalName,
          sources: location!.input.sources,
          links: { socials: {} },
          previousEdition: null,
          currentOrNextEdition: {
            key: target.editionKey,
            ...target.findings,
            links: {},
          },
        },
        errors: [],
        unresolved: [],
      }),
      generateEditor: generateFixtureEditor,
      generateLocation: (prompt, context) =>
        locationDecision(item, JSON.parse(prompt), context.geocode),
    }),
  );
  const report = await runCatalogEvals({
    caseIds: [pipeline.id],
    suite: { ...suite, cases: [pipeline] },
  });
  expect(report.groups[0].group).toBe("regression/pipeline");
  expect(report.groups[0].results).toHaveLength(1);
  const output = report.groups[0].results[0].output!;
  expect(output.report?.errors).toEqual([]);
  expect(output.report?.locationStatus).toBe("success");
  expect(
    output.report?.geocoding.observations.some(
      (observation) => observation.result.status === "success",
    ),
  ).toBe(true);
  expect(output.score!.passed).toBe(true);
  expect(report.groups[0].results.every(evalItemPassed)).toBe(true);
});

test.each(
  cases.filter((item) =>
    [
      "location-central-park",
      "location-building-complex",
      "location-move-city-fallback",
    ].includes(item.id),
  ),
)(
  "$id runs through the integrated workflow with offline Location decisions",
  async (item) => {
    const { seedDatabase } = await import("./run");
    const { runFixtureResearch } = await import("@/test/ingestion");
    const pipeline = pipelineEvalCaseSchema.parse({
      ...item,
      location: undefined,
    });
    const connection = seedDatabase(suite, pipeline);
    try {
      const target = item.location.input.currentOrNextEdition!;
      const result = await runFixtureResearch(item.input, {
        client: connection.client,
        config,
        todayUtc: "2026-10-24",
        generateCandidate: async () => ({
          status: "success",
          data: {
            eventId: pipeline.initial.event.id,
            eventName: pipeline.initial.event.canonicalName,
            sources: item.location.input.sources,
            links: { socials: {} },
            previousEdition: null,
            currentOrNextEdition: {
              key: target.editionKey,
              ...target.findings,
              links: {},
            },
          },
          errors: [],
          unresolved: [],
        }),
        geocodingClient: fixedGeocoding(item),
        generateLocation: (prompt, context) =>
          locationDecision(item, JSON.parse(prompt), context.geocode),
      });
      expect(result.errors).toEqual([]);
      expect(result.locationStatus).toBe("success");
      expect(result.schemaVersion).toBe(7);
      expect(result).not.toHaveProperty("usage");
      const saved = connection.client
        .prepare(
          "SELECT latitude,longitude,coordinate_precision FROM editions WHERE edition_key=?",
        )
        .get(target.editionKey);
      const before = pipeline.initial.event.editions[0];
      expect(saved).toEqual({
        latitude: before.latitude,
        longitude: before.longitude,
        coordinate_precision: before.coordinatePrecision,
      });
      if (item.location.group === "preservation") {
        expect(
          result.changes.some((change) =>
            ["latitude", "longitude", "coordinate_precision"].includes(
              change.field,
            ),
          ),
        ).toBe(false);
      } else {
        expect(
          result.changes.some((change) =>
            ["latitude", "longitude", "coordinate_precision"].includes(
              change.field,
            ),
          ),
        ).toBe(true);
      }
    } finally {
      connection.client.close();
    }
  },
);

test("Location preview traces failures without mock usage and saves real correlation", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubEnv("CATALOG_TRACING", "true");
  const directory = mkdtempSync(join(tmpdir(), "eventroam-location-trace-"));
  const tracePath = join(directory, "observability.duckdb");
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", tracePath);
  const selected = cases
    .filter((item) => item.location.group === "preservation")
    .slice(0, 1);
  mockLocation();
  try {
    const report = await runCatalogEvals({
      locationOnly: true,
      suite: { ...suite, cases: selected },
    });
    const { readTraceRows } = await import("@/test/tracing-fixture");
    const rows = await readTraceRows(tracePath);
    expect(report.groups[0].results[0].output?.traceId).toBeTruthy();
    const locationSpan = rows.mastra_ai_spans.find(
      (span) => span.name === "resolve-location",
    )!;
    expect(JSON.parse(locationSpan.metadata as string).promptVersion).toBe(
      LOCATION_PROMPT_VERSION,
    );
    expect(
      rows.mastra_ai_spans.some(
        (span) =>
          String(span.name).includes("geocoding · initial · reverse") &&
          span.error,
      ),
    ).toBe(true);
    expect(
      rows.mastra_metrics.some((metric) =>
        String(metric.name).includes("tokens"),
      ),
    ).toBe(false);
    const saved = await readSavedResults(report.groups[0]);
    expect(saved.results[0].output).toMatchObject({
      runId: report.groups[0].results[0].output!.runId,
      traceId: report.groups[0].results[0].output!.traceId,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

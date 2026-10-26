import { afterEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
import { resolveLocation } from "../location/agent";
import { createResearchBudget } from "../runtime/budget";
import {
  LOCATION_PROMPT_VERSION,
  type Precision,
  type RegisteredPoint,
} from "../location/contracts";
import type { LocationInput } from "../location/input";
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
type Prompt = LocationInput & { points: RegisteredPoint[] };
/** Explicit fixture choices test integration, not model accuracy. */
async function decision(
  item: LocationEvalCase,
  prompt: Prompt,
  geocode: (query: {
    query: string;
    countryCode: string | null;
  }) => Promise<unknown>,
) {
  const plan = fixtureLocationPlan(prompt);
  if (plan.decision.status !== "ready") {
    throw new Error("Fixture must be ready");
  }
  const target = plan.decision.currentOrNextEdition!;
  if (item.location.group === "preservation") {
    return plan;
  }
  const point = item.expectations.required.find(
    (assertion) => assertion.field === "coordinates",
  )!.value as {
    latitude: number;
    longitude: number;
    precision: Precision;
  };
  if (point == null || point.precision === "locality") {
    target.unresolved.push({
      field: "coordinates",
      message: "The venue point is not resolved by the supplied evidence",
    });
  }
  if (point == null) {
    target.coordinates = {
      action: "clear",
      reason: "The move disproves the old point and no replacement applies",
    };
    return plan;
  }
  let found = prompt.points.find(
    (candidate) =>
      candidate.latitude === point.latitude &&
      candidate.longitude === point.longitude,
  );
  if (!found) {
    const fixture = item.geocoding!.find(
      (fixture) =>
        fixture.response.status === "success" &&
        fixture.response.direction === "forward" &&
        fixture.response.candidates.some(
          (candidate) =>
            candidate.latitude === point.latitude &&
            candidate.longitude === point.longitude,
        ),
    )!;
    if (fixture.request.direction !== "forward") {
      throw new Error("Expected forward fixture");
    }
    const result = (await geocode(fixture.request)) as {
      points: RegisteredPoint[];
    };
    found = result.points.find(
      (candidate) =>
        candidate.latitude === point.latitude &&
        candidate.longitude === point.longitude,
    );
  }
  if (!found) {
    throw new Error("Expected registered point");
  }
  if (found.kind === "donor") {
    target.coordinates = {
      action: "inherit",
      donorPointId: found.id,
      reason: "The historical venue point applies to this Edition",
    };
    return plan;
  }
  target.coordinates = {
    action: "select",
    pointId: found.id,
    precision: point.precision,
    reason: "Fixture identifies the supported point",
  };
  if (item.id === "location-official-venue-point") {
    target.unresolved.push({
      field: "coordinates",
      message:
        "The official venue point differs from saved history; supplied evidence does not explain the distance or disprove the official point",
    });
  }
  return plan;
}
for (const item of cases) {
  test(`${item.id} exercises real preparation, point validation and scoring`, async () => {
    const execution = await resolveLocation(
      item.location.input,
      createResearchBudget(),
      config,
      {
        geocodingClient: fixedGeocoding(item),
        generateLocation: (prompt, context) =>
          decision(item, JSON.parse(prompt), context.geocode),
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
        object: await decision(item, prompt, geocode),
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
  expect(report.modelVersion).toBe("fixture/selected-model");
  expect(report.locationModelVersion).toBe("fixture/selected-model");
  expect(report.promptVersion).toBe(LOCATION_PROMPT_VERSION);
  expect(report.results.every(evalItemPassed)).toBe(true);
  expect(
    report.results.every(
      (item) =>
        !item.output?.report &&
        item.output?.location?.observations.length &&
        item.output.runId,
    ),
  ).toBe(true);
  expect(report.results.every((item) => item.group === "preservation")).toBe(
    true,
  );
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
    const directory = mkdtempSync(join(tmpdir(), "eventroam-location-eval-"));
    const reportPath = join(directory, "report.json");
    try {
      const code = await executeCatalogEvalCommand(
        ["--location-only", "--report", reportPath],
        {
          stdout: vi.fn(),
          runEvals: (options) =>
            runCatalogEvals({
              ...options,
              suite: { ...suite, cases: selected },
            }),
        },
      );
      expect(code).toBe(1);
      expect(model).toHaveBeenCalledTimes(2);
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      expect(report.results).toHaveLength(2);
      expect(report.results[0].output.location.status).toBe("success");
      expect(report.results[0].output.score.diagnostics.execution).toEqual([
        "Unmatched geocoding fixture: fixture_miss",
      ]);
      expect(report.results[1].output.location.status).toBe("success");
      if (origin === "initial") {
        expect(report.results[1].output.score.passed).toBe(true);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
test("exclusive modes reject before setup and missing required native scores fail", async () => {
  const model = mockLocation();
  await expect(
    runCatalogEvals({ locationOnly: true, editorOnly: true }),
  ).rejects.toThrow("mutually exclusive");
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
    const item = report.results[0];
    expect(item.output?.location).toMatchObject({
      status: "rejected",
      materialized: null,
      errors: [
        { code: "location_rejected", stage: "location", message: reason },
      ],
    });
    expect(item.output?.score.diagnostics.execution).toEqual(
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
        decision(item, JSON.parse(prompt), context.geocode),
    }),
  );
  const report = await runCatalogEvals({
    suite: { ...suite, cases: [pipeline] },
  });
  expect(report.evaluationMode).toBe("pipeline");
  expect(report.results).toHaveLength(1);
  const output = report.results[0].output!;
  expect(output.report?.errors).toEqual([]);
  expect(output.report?.locationStatus).toBe("success");
  expect(
    output.report?.geocoding.observations.some(
      (observation) => observation.result.status === "success",
    ),
  ).toBe(true);
  expect(output.score.passed).toBe(true);
  expect(report.results.every(evalItemPassed)).toBe(true);
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
          decision(item, JSON.parse(prompt), context.geocode),
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

test("Location preview traces failures without mock usage and protects the report destination", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubEnv("CATALOG_TRACING", "true");
  const directory = mkdtempSync(join(tmpdir(), "eventroam-location-trace-"));
  const reportPath = join(directory, "report.json");
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
    expect(report.results[0].output?.traceId).toBeTruthy();
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
    vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", reportPath);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const collision = await runCatalogEvals({
      locationOnly: true,
      suite: { ...suite, cases: selected },
      reportPath,
    });
    expect(collision.results[0].output?.traceId).toBeUndefined();
    expect(JSON.parse(readFileSync(reportPath, "utf8")).results).toHaveLength(
      1,
    );
    expect(stderr.mock.calls.flat().join("")).toContain(
      "trace_initialization_failed",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import * as workflow from "../workflow";
import { runCatalogEvals, evaluationConfig, evalItemPassed } from "./run";
import {
  loadEvalSuite,
  type PipelineEvalCase,
  type LocationEvalCase,
} from "./fixtures";
import { createEvalStore } from "./storage";
import { canonicalJson, evalDataset, prepareEvalDataset } from "./datasets";
import { mainCandidate } from "@/test/eval-main";
import {
  generateFixtureEditor,
  generateFixtureLocation,
} from "@/test/ingestion";
import { locationDecision } from "@/test/eval-location";
import { readSavedResults } from "@/test/eval-storage";
import type { LocationInput } from "../location/input";
import type { RegisteredPoint } from "../location/contracts";
import {
  executeCatalogEvalCommand,
  parseEvalArgs,
} from "../../../commands/catalog-eval";
const suite = loadEvalSuite();
const executeResearch = workflow.runCatalogResearch;
let directory: string;
const modelErrors: string[] = [];
beforeEach(() => {
  modelErrors.length = 0;
  directory = mkdtempSync(join(tmpdir(), "eventroam-full-evals-"));
  vi.stubEnv("CATALOG_EVAL_DATABASE_PATH", join(directory, "evals.sqlite"));
  vi.stubEnv("DATABASE_PATH", join(directory, "catalog.sqlite"));
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  writeFileSync(join(directory, "catalog.sqlite"), "owner catalog sentinel");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(directory, { recursive: true, force: true });
});

function substituteModels() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Live source access is forbidden");
    }),
  );
  const execute = vi
    .spyOn(workflow, "runCatalogResearch")
    .mockImplementation((input, deps) => {
      expect(deps.config!.model).toBe("fixture/selected");
      expect(deps.config!.locationModel).toBe("fixture/selected");
      const item = suite.cases.find(
        (item) => !item.location && item.input.eventId === input.eventId,
      )! as PipelineEvalCase;
      // Several regressions share an Event; use the actual fixture sources for identity.
      return executeResearch(input, {
        ...deps,
        ...(!deps.generateCandidate
          ? {
              generateCandidate: async () =>
                item.suite === "main"
                  ? mainCandidate(item)
                  : item.id === "narrow-current-none"
                    ? {
                        status: "success",
                        data: {
                          eventName: "River Festival",
                          sources: [],
                          links: { socials: {} },
                          previousEdition: null,
                          currentOrNextEdition: null,
                        },
                        errors: [],
                        unresolved: [],
                      }
                    : {
                        status: "failed",
                        data: null,
                        errors: [],
                        unresolved: [],
                      },
            }
          : {}),
        generateEditor: generateFixtureEditor,
        generateLocation: generateFixtureLocation,
      });
    });
  vi.spyOn(Agent.prototype, "generate").mockImplementation(async function (
    this: Agent,
    raw: unknown,
  ) {
    expect(this.id).toBe("festival-location");
    const prompt = JSON.parse(raw as string) as LocationInput & {
      points: RegisteredPoint[];
    };
    const candidates = suite.cases.filter(
      (item): item is LocationEvalCase =>
        !!item.location &&
        canonicalJson(item.location.input) ===
          canonicalJson(
            Object.fromEntries(
              Object.keys(item.location.input).map((key) => [
                key,
                prompt[key as keyof LocationInput],
              ]),
            ),
          ),
    );
    const prepared = (
      prompt as unknown as { prepared: { request: unknown; result: unknown }[] }
    ).prepared;
    const item =
      candidates.find((candidate) =>
        prepared.every((observation) =>
          candidate.geocoding?.some(
            (fixture) =>
              canonicalJson(fixture.request) ===
                canonicalJson(observation.request) &&
              canonicalJson(fixture.response) ===
                canonicalJson(observation.result),
          ),
        ),
      ) ?? candidates[0];
    const tools = await this.listTools();
    const geocode = async (query: {
      query: string;
      countryCode: string | null;
    }) =>
      "execute" in tools.geocode
        ? tools.geocode.execute!(query, {} as never)
        : Promise.reject(new Error("Missing geocode"));
    try {
      return {
        text: "",
        object: await locationDecision(item, prompt, geocode),
      } as never;
    } catch (error) {
      modelErrors.push(`${prompt.festival.name}: ${String(error)}`);
      throw error;
    }
  });
  return execute;
}

test("all 50 cases run as four saved experiments; a failed Location case does not stop siblings", async () => {
  vi.stubEnv("CATALOG_LOCATION_MODEL", "fixture/environment-location");
  substituteModels();
  const selected = structuredClone(suite);
  const failedId = "location-bridge";
  selected.cases.find((item) => item.id === failedId)!.geocoding = [];
  const stdout = vi.fn();
  const runs: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
  const code = await executeCatalogEvalCommand(
    ["--all", "--model", "fixture/selected"],
    {
      stdout,
      runEvals: async (options) => {
        const run = await runCatalogEvals({ ...options, suite: selected });
        runs.push(run);
        return run;
      },
    },
  );
  expect(modelErrors).toEqual([]);
  expect(code).toBe(1);
  const groups = runs[0].groups;
  expect(
    groups.map((group) => [group.group, group.caseCount, group.totalItems]),
  ).toEqual([
    ["main/pipeline", 5, 5],
    ["regression/pipeline", 25, 25],
    ["regression/editor", 7, 7],
    ["regression/location", 13, 13],
  ]);
  expect(groups[0].results.every(evalItemPassed)).toBe(true);
  expect(
    groups[1].results.filter(evalItemPassed).map((item) => item.caseId),
  ).toEqual(["narrow-current-none"]);
  expect(groups[2].results.every(evalItemPassed)).toBe(true);
  expect(
    groups[3].results
      .filter((item) => !evalItemPassed(item))
      .map((item) => [
        item.caseId,
        item.error,
        item.output?.score?.diagnostics,
      ]),
  ).toEqual([
    [
      failedId,
      null,
      expect.objectContaining({
        execution: ["Unmatched geocoding fixture: fixture_miss"],
      }),
    ],
  ]);
  expect(
    groups[3].results.find((item) => item.caseId === failedId)!.output!.score!
      .diagnostics.execution,
  ).toContain("Unmatched geocoding fixture: fixture_miss");
  for (const group of groups) {
    const saved = await readSavedResults(group);
    expect(saved.results).toHaveLength(group.caseCount);
    expect(saved.experiment!.metadata).toMatchObject({
      group: group.group,
      revision: group.revision,
      models: {
        research: "fixture/selected",
        editor: "fixture/selected",
        location: "fixture/selected",
      },
      promptVersions: {
        research: expect.any(String),
        editor: expect.any(String),
        location: expect.any(String),
      },
      workflowRevision: expect.any(String),
      reasoningEffort: "medium",
      serviceTier: "flex",
      limits: expect.any(Object),
    });
    expect(
      saved.results.every((result) => {
        const output = result.output as {
          report?: { runId: string };
          runId?: string;
        };
        return !!(output.report?.runId ?? output.runId);
      }),
    ).toBe(true);
    expect(saved.scores.length).toBe(
      group.group === "main/pipeline" ? 17 : group.caseCount,
    );
  }
  expect(readFileSync(join(directory, "catalog.sqlite"), "utf8")).toBe(
    "owner catalog sentinel",
  );
  const text = stdout.mock.calls.flat().join("");
  for (const word of [
    "main/pipeline",
    "regression/pipeline",
    "regression/editor",
    "regression/location",
    "completion:",
    "correction:",
    "preservation:",
    "N/A",
    "experiment:",
  ]) {
    expect(text).toContain(word);
  }
  expect(fetch).not.toHaveBeenCalled();
}, 15000);

test("default main runs save comparable experiments with the same native item IDs and honest N/A", async () => {
  const execute = substituteModels();
  const first = await runCatalogEvals({ model: "fixture/selected" });
  const second = await runCatalogEvals({ model: "fixture/selected" });
  expect(first.groups).toHaveLength(1);
  expect(first.groups[0].caseCount).toBe(5);
  expect(first.groups[0].results.every(evalItemPassed)).toBe(true);
  expect(
    first.groups[0].results.every(
      (item) => item.output?.quality && !("score" in item.output),
    ),
  ).toBe(true);
  expect(second.groups[0].datasetId).toBe(first.groups[0].datasetId);
  expect(second.groups[0].experimentId).not.toBe(first.groups[0].experimentId);
  expect(second.groups[0].results.map((item) => item.itemId)).toEqual(
    first.groups[0].results.map((item) => item.itemId),
  );
  expect(execute).toHaveBeenCalledTimes(10);
  expect(execute.mock.calls.every(([input]) => !input.dryRun)).toBe(true);
  const blocked = first.groups[0].results.find(
    (item) => item.caseId === "afro-nation-portugal-blocked",
  )!;
  expect(blocked.scores.filter((score) => score.notScorable)).toHaveLength(2);
  expect(blocked.output!.before).toEqual(blocked.output!.after);
  const stdout = vi.fn();
  const code = await executeCatalogEvalCommand([], {
    stdout,
    runEvals: async () => first,
  });
  expect(code).toBe(0);
  expect(stdout.mock.calls.flat().join("")).toContain("checked errors: 0");
  blocked.output!.quality!.errorCount = 2;
  blocked.output!.quality!.noCheckedErrors = 0;
  blocked.output!.quality!.passed = false;
  const failed = await executeCatalogEvalCommand([], {
    stdout,
    runEvals: async () => first,
  });
  expect(failed).toBe(1);
  expect(stdout.mock.calls.flat().join("")).toContain("checked errors: 2");
});

test("stored edits reject before provider setup and generation", async () => {
  const main = suite.cases.filter((item) => item.suite === "main");
  const store = await createEvalStore();
  try {
    await store.init();
    const ready = await prepareEvalDataset(
      new Mastra({ storage: store, logger: false }),
      evalDataset(suite, main, "main/pipeline", 1),
    );
    await ready.dataset.updateItem({
      itemId: ready.items[0].id,
      groundTruth: { changedInStudio: true },
    });
  } finally {
    await store.close();
  }
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const generate = vi.spyOn(Agent.prototype, "generate");
  await expect(runCatalogEvals()).rejects.toThrow(
    "differs from repository files",
  );
  expect(generate).not.toHaveBeenCalled();
});

test("model selection resolves all stages and retains environment fallback", () => {
  vi.stubEnv("OPENROUTER_MODEL", "fixture/research");
  vi.stubEnv("CATALOG_LOCATION_MODEL", "fixture/location");
  expect(evaluationConfig({})).toMatchObject({
    model: "fixture/research",
    locationModel: "fixture/location",
  });
  expect(evaluationConfig({ model: "fixture/selected" })).toMatchObject({
    model: "fixture/selected",
    locationModel: "fixture/selected",
  });
  vi.stubEnv("CATALOG_LOCATION_MODEL", "");
  expect(evaluationConfig({})).toMatchObject({
    model: "fixture/research",
    locationModel: "fixture/research",
  });
  expect(
    parseEvalArgs([
      "--group",
      "main/pipeline",
      "--group",
      "regression/location",
    ]),
  ).toEqual({ groups: ["main/pipeline", "regression/location"] });
});

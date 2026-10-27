import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { loadEvalSuite } from "./fixtures";
import {
  evalDataset,
  prepareEvalDataset,
  mainEvaluatorSources,
} from "./datasets";
import { createEvalStore } from "./storage";
const suite = loadEvalSuite();
const main = suite.cases.filter((item) => item.suite === "main");

test("resolved sources, search, geocoding, seed, evaluator source, taxonomy, date, repeats and scorer rules change the revision", () => {
  const original = evalDataset(suite, main, "main/pipeline", 1);
  const changed = (mutate: (copy: typeof suite) => void) => {
    const copy = structuredClone(suite);
    mutate(copy);
    return evalDataset(
      copy,
      copy.cases.filter((item) => item.suite === "main"),
      "main/pipeline",
      1,
    ).revision;
  };
  for (const mutate of [
    (copy: typeof suite) => {
      copy.cases[0].sources[0].markdown += " changed";
    },
    (copy: typeof suite) => {
      copy.cases[0].discoveries = [{ queryPattern: "test", candidates: [] }];
    },
    (copy: typeof suite) => {
      copy.cases.find(
        (item) => item.id === "wacken",
      )!.geocoding![0].provenance += " corrected";
    },
    (copy: typeof suite) => {
      copy.cases.find((item) => item.id === "wacken")!.geocoding![0].response =
        { status: "error", code: "provider_error" };
    },
    (copy: typeof suite) => {
      copy.cases[0].initial!.event.canonicalName += " corrected";
    },
    (copy: typeof suite) => {
      const item = copy.cases.find(
        (item) => item.id === "afro-nation-portugal-blocked",
      )!;
      item.expectations.research!.hasUnresolved = false;
    },
    (copy: typeof suite) => {
      copy.cases[0].expectations.toolUse = { maxSearches: 2 };
    },
    (copy: typeof suite) => {
      copy.terms[0].name += " corrected";
    },
    (copy: typeof suite) => {
      copy.cases[0].todayUtc = new Date(
        Date.parse(copy.cases[0].todayUtc ?? copy.todayUtc) + 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
    },
  ]) {
    expect(changed(mutate)).not.toBe(original.revision);
  }
  expect(evalDataset(suite, main, "main/pipeline", 2).revision).not.toBe(
    original.revision,
  );
  expect(
    evalDataset(suite, main, "main/pipeline", 1, "next").revision,
  ).not.toBe(original.revision);
  expect(
    evalDataset(suite, [...main].reverse(), "main/pipeline", 1).revision,
  ).toBe(original.revision);
  const sources = mainEvaluatorSources();
  for (const file of ["main/facts.ts", "main/context.ts", "main/roskilde.ts"]) {
    expect(
      evalDataset(suite, main, "main/pipeline", 1, undefined, {
        ...sources,
        [file]: sources[file] + "\n// Rule changed",
      }).revision,
    ).not.toBe(original.revision);
  }
  const location = suite.cases.find((item) => item.location)!;
  const before = evalDataset(suite, [location], "regression/location", 1);
  const copy = structuredClone(location);
  copy.location!.input.festival.name += " changed";
  expect(
    evalDataset(suite, [copy], "regression/location", 1).revision,
  ).not.toBe(before.revision);
  const editor = suite.cases.find((item) => item.researchHandoff)!;
  const replay = evalDataset(suite, [editor], "regression/editor", 1);
  const altered = structuredClone(editor);
  altered.researchHandoff!.provenance += " corrected";
  expect(
    evalDataset(suite, [altered], "regression/editor", 1).revision,
  ).not.toBe(replay.revision);
});

test("repeat imports keep native item IDs and pin verified versions; stored edits are rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-dataset-"));
  const store = await createEvalStore({
    NODE_ENV: "test",
    CATALOG_EVAL_DATABASE_PATH: join(dir, "evals.sqlite"),
  });
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    const definition = evalDataset(suite, main, "main/pipeline", 2);
    const first = await prepareEvalDataset(mastra, definition);
    const second = await prepareEvalDataset(mastra, definition);
    expect(second.version).toBe(first.version);
    expect(second.items.map((item) => item.id)).toEqual(
      first.items.map((item) => item.id),
    );
    expect(second.items).toHaveLength(10);
    expect(second.items.map((item) => item.externalId).sort()).toEqual(
      definition.items.map((item) => item.externalId).sort(),
    );
    expect(definition.metadata.evaluatorSources).toEqual(
      mainEvaluatorSources(),
    );
    expect(JSON.stringify(second.items)).not.toContain('"evaluatorSources"');
    expect(
      second.items.find((item) => item.externalId === "roskilde/1")!
        .groundTruth,
    ).toEqual(main.find((item) => item.id === "roskilde")!.expectations);
    await second.dataset.update({
      metadata: { ...definition.metadata, note: "Studio note" },
    });
    await second.dataset.updateItem({
      itemId: second.items[0].id,
      scorerIds: ["unused-scorer"],
      requestContext: { unused: true },
    });
    await expect(prepareEvalDataset(mastra, definition)).resolves.toBeDefined();
    await second.dataset.update({
      metadata: { ...definition.metadata, evaluatorSources: { altered: true } },
    });
    await expect(prepareEvalDataset(mastra, definition)).rejects.toThrow(
      "differs from repository",
    );
    await second.dataset.update({ metadata: definition.metadata });
    for (const field of ["input", "groundTruth"] as const) {
      const item = second.items[0];
      await second.dataset.updateItem({
        itemId: item.id,
        [field]: { altered: true },
      });
      await expect(prepareEvalDataset(mastra, definition)).rejects.toThrow(
        "differs from repository",
      );
      await second.dataset.updateItem({
        itemId: item.id,
        [field]: item[field],
      });
    }
    const restored = await prepareEvalDataset(mastra, definition);
    expect(restored.version).toBeGreaterThan(first.version);
    expect(
      await first.dataset.listItems({
        version: first.version,
        page: 0,
        perPage: 100,
      }),
    ).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: first.items[0].id,
          input: first.items[0].input,
        }),
      ]),
    });
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

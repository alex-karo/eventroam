import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { loadEvalSuite } from "./fixtures";
import { evalDataset, evalFileHash, prepareEvalDataset } from "./datasets";
import { createEvalStore } from "./storage";

const suite = loadEvalSuite();
const main = suite.cases.filter((item) => item.suite === "main");

test("file hashes cover all JSON/MD fixtures and main rules, including names and whitespace", () => {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-eval-files-"));
  try {
    const files = [
      "cases/nested/page.md",
      "cases/case.json",
      "main.ts",
      "main/facts.ts",
    ];
    for (const file of files) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), "original");
    }
    const original = evalFileHash(dir);
    expect(evalFileHash(dir)).toBe(original);
    for (const file of files) {
      writeFileSync(join(dir, file), "original ");
      expect(evalFileHash(dir)).not.toBe(original);
      writeFileSync(join(dir, file), "original");
    }
    writeFileSync(join(dir, "main/facts.test.ts"), "test only");
    expect(evalFileHash(dir)).toBe(original);
    renameSync(join(dir, files[0]), join(dir, "cases/nested/renamed.md"));
    expect(evalFileHash(dir)).not.toBe(original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dataset identity adds group, selected IDs, repeats and scorer version to the file hash", () => {
  const original = evalDataset(suite, main, "main/pipeline", 1, "2", "files");
  expect(
    evalDataset(suite, [...main].reverse(), "main/pipeline", 1, "2", "files")
      .id,
  ).toBe(original.id);
  for (const changed of [
    evalDataset(suite, main, "main/pipeline", 1, "2", "changed-files"),
    evalDataset(suite, main, "regression/pipeline", 1, "2", "files"),
    evalDataset(suite, main.slice(1), "main/pipeline", 1, "2", "files"),
    evalDataset(suite, main, "main/pipeline", 2, "2", "files"),
    evalDataset(suite, main, "main/pipeline", 1, "3", "files"),
  ]) {
    expect(changed.id).not.toBe(original.id);
  }
});

test("imports reuse items without reading or comparing them, and pin the current version", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-dataset-"));
  const store = await createEvalStore({
    NODE_ENV: "test",
    CATALOG_EVAL_DATABASE_PATH: join(dir, "evals.sqlite"),
  });
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    const definition = evalDataset(suite, main, "main/pipeline", 2);
    const datasets = (await store.getStore("datasets"))!;
    const list = () =>
      datasets.listItems({
        datasetId: definition.id,
        pagination: { page: 0, perPage: 100 },
      });
    const first = await prepareEvalDataset(mastra, definition);
    const initial = await list();
    expect(initial.items).toHaveLength(10);
    expect(initial.items.map((item) => item.externalId).sort()).toEqual(
      definition.items.map((item) => item.externalId).sort(),
    );
    expect((await first.dataset.getDetails()).metadata).not.toHaveProperty(
      "evaluatorSources",
    );
    await first.dataset.updateItem({
      itemId: initial.items[0].id,
      groundTruth: { editedInStudio: true },
    });
    const read = vi
      .spyOn(datasets, "listItems")
      .mockRejectedValue(new Error("Do not read saved items"));
    const second = await prepareEvalDataset(mastra, definition);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
    expect(second.version).toBeGreaterThan(first.version);
    const reused = await list();
    expect(reused.items.map((item) => item.id).sort()).toEqual(
      initial.items.map((item) => item.id).sort(),
    );
  } finally {
    vi.restoreAllMocks();
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

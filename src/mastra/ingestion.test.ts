import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { afterEach, expect, test, vi } from "vitest";
import { createStudioIngestionWorkflow } from "./ingestion";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("graph inspection is lazy and execution never creates a missing catalog", async () => {
  const directory = mkdtempSync(join(tmpdir(), "eventroam-studio-lazy-"));
  directories.push(directory);
  const catalog = join(directory, "missing.sqlite");
  vi.stubEnv("DATABASE_PATH", catalog);
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const store = new DuckDBStore({
    path: join(directory, "observability.duckdb"),
  });
  const workflow = createStudioIngestionWorkflow(store);
  expect(Object.keys(workflow.steps)).toEqual([
    "initialize-run",
    "load-context",
    "read-initial-source",
    "research-festival",
    "prepare-candidate",
    "apply-catalog-item",
    "build-report",
    "finalize-run",
  ]);
  expect(existsSync(catalog)).toBe(false);
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
  const run = await workflow.createRun();
  await expect(
    run.start({
      inputData: {
        mode: "add",
        name: "Fixture",
        dryRun: true,
        republish: false,
      },
    }),
  ).rejects.toThrow("Ingestion workflow failed");
  expect(existsSync(catalog)).toBe(false);
});

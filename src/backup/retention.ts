import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DuckDBStore } from "@mastra/duckdb";
import { LibSQLStore } from "@mastra/libsql";
import { noopLogger } from "@mastra/core/logger";
import type { PruneResult } from "@mastra/core/storage";
import { checkDatabases } from "./storage";

function checkPrune(results: PruneResult[], expected: number) {
  console.log(JSON.stringify(results));
  // Mastra logs a domain error and omits its results instead of rejecting.
  if (results.length !== expected || results.some((result) => !result.done)) {
    throw new Error("Retention did not complete for every configured table");
  }
}

async function pruneNative(root: string) {
  const observations = new DuckDBStore({
    path: join(root, "mastra-observability.duckdb"),
    threads: 1,
    memoryLimit: "512MB",
    retention: {
      observability: {
        spans: { maxAge: "7d" },
        logs: { maxAge: "90d" },
        metrics: { maxAge: "90d" },
        scores: { maxAge: "90d" },
        feedback: { maxAge: "90d" },
      },
    },
  });
  observations.__setLogger(noopLogger);
  try {
    await observations.init();
    checkPrune(await observations.prune(), 5);
  } finally {
    await observations.close();
  }
  for (const [name, retention, expected] of [
    [
      "mastra-workflows.sqlite",
      { workflows: { workflowSnapshot: { maxAge: "90d" } } },
      1,
    ],
    [
      "mastra-chat.sqlite",
      {
        memory: {
          messages: { maxAge: "90d" },
          threads: { maxAge: "90d" },
        },
      },
      2,
    ],
    [
      "mastra-evals.sqlite",
      {
        experiments: { experiments: { maxAge: "90d" } },
        scores: { scorers: { maxAge: "90d" } },
      },
      3,
    ],
  ] as const) {
    const store = new LibSQLStore({
      id: "backup-retention",
      url: pathToFileURL(join(root, name)).href,
      disableInit: true,
      retention,
    });
    store.__setLogger(noopLogger);
    try {
      checkPrune(await store.prune(), expected);
    } finally {
      await store.close();
    }
  }
}

/** Call only after a complete backup, while Studio remains stopped. */
export async function applyRetention(root: string) {
  await pruneNative(root);
  execFileSync(
    "/bin/sh",
    [
      "-ec",
      `/usr/bin/find "$1" -type f -mmin +43200 -delete
/usr/bin/find "$1" -depth -mindepth 1 -type d -empty -delete`,
      "prune-sources",
      join(root, "ingestion-sources"),
    ],
    { stdio: "inherit" },
  );
  await checkDatabases(root, true);
}

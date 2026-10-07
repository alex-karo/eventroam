import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "@/db/connection";
import { readDatabaseEnvironment } from "@/db/env";
import {
  runCatalogResearch,
  type CatalogResearchResult,
  type ResearchDependencies,
} from "@/ingestion/workflow";
import { parseCatalogOptions, catalogUsage } from "./catalog-options";

export function formatCatalogReport(
  results: CatalogResearchResult[],
  dryRun: boolean,
) {
  const lines = [
    dryRun ? "Catalog dry-run — no changes applied" : "Catalog apply",
  ];
  for (const result of results) {
    lines.push(
      `${result.outcome}: ${result.eventId ?? "new festival"} (${result.durationMs} ms)`,
    );
    for (const change of result.changes) {
      lines.push(
        `  ${change.subject}.${change.field}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`,
      );
    }
    for (const source of result.sources) {
      const reason = source.reason ? ` (${source.reason})` : "";
      lines.push(
        `  ${source.outcome}: ${source.finalUrl} [${source.retrievedAt}]${reason}`,
      );
    }
    for (const gap of result.gaps) {
      const edition = gap.editionKey ? ` [${gap.editionKey}]` : "";
      const field = gap.field ? `: ${gap.field}` : "";
      const detail = gap.detail ? ` — ${gap.detail}` : "";
      lines.push(`  ${gap.code}${edition}${field}${detail}`);
    }
    lines.push(
      `  Model: ${result.modelVersion}; reasoning: ${result.reasoningEffort ?? "provider default"}; prompt: ${result.promptVersion}; tokens: ${result.usage.inputTokens}/${result.usage.outputTokens}; cached input: ${result.usage.cachedInputTokens ?? "unavailable"}; reasoning tokens: ${result.usage.reasoningTokens ?? "unavailable"}; model USD: ${result.usage.modelCostUsd ?? "unavailable"}; search USD: ${result.usage.searchCostUsd}`,
    );
  }
  return lines.join("\n");
}

export async function executeCatalogCommand(
  args: string[],
  deps: {
    research?: typeof runCatalogResearch;
    researchDependencies?: Omit<ResearchDependencies, "client">;
    stdout?: (value: string) => void;
  } = {},
) {
  const options = parseCatalogOptions(args);
  const output = deps.stdout ?? console.log;
  if (options.help) {
    output(catalogUsage);
    return 0;
  }
  const database = options.database ?? readDatabaseEnvironment().DATABASE_PATH;
  const reportPath = options.report ? resolve(options.report) : undefined;
  if (
    reportPath &&
    [database, `${database}-wal`, `${database}-shm`].some(
      (path) => resolve(path) === reportPath,
    )
  ) {
    throw new Error("Report path must differ from database files.");
  }
  if (!existsSync(database)) {
    throw new Error(
      "Catalog does not exist; run db:migrate with the intended DATABASE_PATH first.",
    );
  }
  const connection = openDatabase(database);
  try {
    for (const id of options.eventIds) {
      if (
        !connection.client.prepare("SELECT id FROM events WHERE id=?").get(id)
      ) {
        throw new Error("Event ID not found.");
      }
    }
    const targets = options.mode === "add" ? [undefined] : options.eventIds;
    const results: CatalogResearchResult[] = [];
    const failures: { eventId?: string; code: string }[] = [];
    for (const eventId of targets) {
      try {
        results.push(
          await (deps.research ?? runCatalogResearch)(
            {
              mode: options.mode,
              name: options.name,
              eventId,
              actor: "catalog-research",
              dryRun: options.dryRun,
              republish: options.republish,
              limits: options.limits,
            },
            { client: connection.client, ...deps.researchDependencies },
          ),
        );
      } catch {
        // Provider exceptions may contain request bodies or credentials. Never serialize them.
        failures.push({ eventId, code: "research_failed" });
      }
    }
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      results,
      failures,
    };
    const json = JSON.stringify(report, null, 2);
    if (reportPath) {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, json + "\n", { mode: 0o600 });
    }
    output(
      options.json
        ? json
        : [
            formatCatalogReport(results, options.dryRun),
            ...failures.map(
              (f) => `failed: ${f.eventId ?? "new festival"} (${f.code})`,
            ),
          ].join("\n"),
    );
    return failures.length || results.some((r) => r.outcome === "failed")
      ? 1
      : 0;
  } finally {
    connection.client.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  executeCatalogCommand(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message =
        error instanceof Error ? error.message : "Catalog command failed";
      console.error(message);
      process.exitCode = 1;
    });
}

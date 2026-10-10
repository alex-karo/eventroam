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
import { RunPersistenceError, hasHostFailure } from "@/ingestion/runs";
import { parseCatalogOptions, catalogUsage } from "./catalog-options";

function formatTokens(usage: CatalogResearchResult["usage"]) {
  return `${usage.inputTokens}/${usage.outputTokens}${usage.complete === false ? " (partial)" : ""}`;
}

export function formatCatalogReport(
  results: CatalogResearchResult[],
  dryRun: boolean,
) {
  return [
    dryRun ? "Catalog dry-run — no changes applied" : "Catalog apply",
    ...results.flatMap(formatResult),
  ].join("\n");
}

function formatResult(result: CatalogResearchResult): string[] {
  const mismatch = result.eventNameMismatch;
  return [
    `Run ${result.runId ?? "unavailable"}: ${result.outcome} (research ${result.researchStatus}): ${result.eventId ?? "new festival"} (${result.durationMs} ms)`,
    ...result.changes.flatMap((change) => [
      `  ${change.subject}.${change.field}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`,
      ...change.explanations.map((explanation) => `    Why: ${explanation}`),
    ]),
    ...(mismatch
      ? [
          `  Name differs for ${mismatch.eventId}: saved ${JSON.stringify(mismatch.storedName)}, observed ${JSON.stringify(mismatch.observedName)}`,
        ]
      : []),
    ...result.sourceSummaries.map(
      (summary) => `  Source summary: ${summary.url} — ${summary.information}`,
    ),
    ...result.sources.map(
      (source) =>
        `  ${source.outcome}: ${source.finalUrl} [${source.retrievedAt}]${optionalSuffix(source.reason, " (", ")")}`,
    ),
    ...result.errors.map(
      (error) =>
        `  Error (${error.stage}/${error.code})${optionalSuffix(error.editionKey, " [", "]")}${optionalSuffix(error.field, ": ")}: ${error.message}${optionalSuffix(error.diagnostic ? formatModelDiagnostic(error.diagnostic) : undefined, " [", "]")}`,
    ),
    ...result.unresolved.map(
      (question) =>
        `  Unresolved${optionalSuffix(question.editionKey, " [", "]")}${optionalSuffix(question.field, ": ")}: ${question.message}`,
    ),
    `  Model: ${result.modelVersion}; reasoning: ${result.reasoningEffort ?? "provider default"}; prompt: ${result.promptVersion}; tokens: ${formatTokens(result.usage)}; cached input: ${result.usage.cachedInputTokens ?? "unavailable"}; reasoning tokens: ${result.usage.reasoningTokens ?? "unavailable"}; model USD: ${result.usage.modelCostUsd ?? "unavailable"}; estimated search USD: ${result.usage.searchCostUsd}`,
  ];
}

function formatModelDiagnostic(
  diagnostic: NonNullable<
    CatalogResearchResult["errors"][number]["diagnostic"]
  >,
) {
  return [
    `type=${diagnostic.errorTypes.join(">")}`,
    ...(diagnostic.httpStatus !== undefined
      ? [`http=${diagnostic.httpStatus}`]
      : []),
    ...(diagnostic.providerCode !== undefined
      ? [`code=${diagnostic.providerCode}`]
      : []),
    ...(diagnostic.retryable !== undefined
      ? [`retryable=${diagnostic.retryable}`]
      : []),
  ].join(" ");
}

function optionalSuffix(value: string | undefined, before: string, after = "") {
  return value ? before + value + after : "";
}

type CommandFailure = { eventId?: string; code: string; runId?: string };

function commandFailure(
  error: unknown,
  eventId: string | undefined,
  results: CatalogResearchResult[],
): CommandFailure {
  if (error instanceof RunPersistenceError) {
    if (error.report) {
      results.push(error.report);
    }
    return {
      eventId,
      code: "run_persistence_failed",
      ...(error.runId ? { runId: error.runId } : {}),
    };
  }
  // Provider exceptions may contain request bodies or credentials. Never serialize them.
  return { eventId, code: "research_failed" };
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
    const failures: CommandFailure[] = [];
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
            {
              client: connection.client,
              ...deps.researchDependencies,
              reportPath,
            },
          ),
        );
      } catch (error) {
        failures.push(commandFailure(error, eventId, results));
      }
    }
    const report = {
      schemaVersion: 2,
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
              (f) =>
                `failed: ${f.eventId ?? "new festival"} (${f.code})${optionalSuffix(f.runId, " [run ", "]")}`,
            ),
          ].join("\n"),
    );
    return failures.length ||
      results.some((r) => r.outcome === "failed" || hasHostFailure(r))
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

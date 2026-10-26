import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { runCatalogEvals, evalItemPassed } from "@/ingestion/evals/run";
import type { EvalOptions } from "@/ingestion/evals/run";

function parseArgs(args: string[]): EvalOptions {
  const options: EvalOptions = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: npm run catalog:eval -- [--editor-only | --location-only] [--case ID] [--model OPENROUTER_MODEL] [--repeat N] [--report PATH]\nRuns fixed-source Mastra catalog evals; pipeline excludes handoffs; --editor-only replays them. --case must match the selected mode.\n",
      );
      process.exit(0);
    }
    if (arg === "--location-only") {
      options.locationOnly = true;
      continue;
    }
    if (arg === "--editor-only") {
      options.editorOnly = true;
      continue;
    }
    if (!["--case", "--model", "--repeat", "--report"].includes(arg)) {
      throw new Error(`Unknown eval option: ${arg}`);
    }
    const value = args[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    switch (arg) {
      case "--case":
        options.caseIds = [...(options.caseIds ?? []), value];
        break;
      case "--model":
        options.model = value;
        break;
      case "--repeat":
        options.repeat = Number(value);
        break;
      case "--report":
        options.reportPath = resolve(value);
        break;
    }
  }
  if (options.locationOnly && options.editorOnly) {
    throw new Error("--location-only and --editor-only are mutually exclusive");
  }
  return options;
}

export async function executeCatalogEvalCommand(
  args: string[],
  deps: {
    runEvals?: typeof runCatalogEvals;
    stdout?: (value: string) => void;
  } = {},
) {
  const options = parseArgs(args);
  const output =
    deps.stdout ?? ((value: string) => process.stdout.write(value));
  if (!options.reportPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    options.reportPath = resolve(`data/catalog-evals/${stamp}.json`);
  }
  const report = await (deps.runEvals ?? runCatalogEvals)(options);
  const passed = report.results.filter(evalItemPassed).length;
  output(
    `${passed}/${report.results.length} cases passed; report: ${options.reportPath}\n`,
  );
  for (const group of ["completion", "correction", "preservation"]) {
    const items = report.results.filter((item) => item.group === group);
    if (items.length) {
      output(
        `${group}: ${items.filter(evalItemPassed).length}/${items.length} cases passed\n`,
      );
    }
  }
  for (const item of report.results) {
    const value = item.output;
    if (!value) {
      output(`${item.caseId} #${item.repetition}: execution failed\n`);
      continue;
    }
    output(
      `${item.caseId} #${item.repetition}: correctness ${value.score.correctness.toFixed(2)}, completeness ${value.score.completeness.toFixed(2)}, ${value.report?.outcome ?? "location"} [run ${value.report?.runId ?? value.runId ?? "unavailable"}]\n`,
    );
    if (!evalItemPassed(item)) {
      for (const [dimension, failures] of Object.entries(
        value.score.diagnostics,
      )) {
        for (const failure of failures) {
          output(`  ${dimension}: ${failure}\n`);
        }
      }
      if (item.error || item.scores.some((score) => score.error)) {
        output("  execution: task or scorer failed\n");
      }
    }
  }
  return passed === report.results.length ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  executeCatalogEvalCommand(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      let message = error instanceof Error ? error.name : "unknown error";
      if (
        error instanceof Error &&
        /^(OPENROUTER_API_KEY is required|OPENROUTER_MODEL must not enable automatic web search|OPENROUTER_REASONING_EFFORT is invalid|Unknown eval option:|Missing value for|Unknown or empty eval case selection|Editor-only eval requires|Pipeline eval does not accept|repeat must be|Eval report already exists:)/.test(
          error.message,
        )
      ) {
        message = error.message;
      }
      process.stderr.write(`Catalog eval failed: ${message}\n`);
      process.exitCode = 1;
    });
}

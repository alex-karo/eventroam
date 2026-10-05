import { resolve } from "node:path";
import { runCatalogEvals } from "@/ingestion/evals/run";
import type { EvalOptions } from "@/ingestion/evals/run";

function parseArgs(args: string[]): EvalOptions {
  const options: EvalOptions = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: npm run catalog:eval -- [--case ID] [--model OPENROUTER_MODEL] [--repeat N] [--report PATH]\nRuns fixed-source Mastra catalog evals against the configured OpenRouter model.\n",
      );
      process.exit(0);
    }
    if (!["--case", "--model", "--repeat", "--report"].includes(arg))
      throw new Error(`Unknown eval option: ${arg}`);
    const value = args[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
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
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.reportPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    options.reportPath = resolve(`data/catalog-evals/${stamp}.json`);
  }
  const report = await runCatalogEvals(options);
  const passed = report.results.filter((item) => item.score.passed).length;
  process.stdout.write(
    `${passed}/${report.results.length} cases passed; report: ${options.reportPath}\n`,
  );
  for (const item of report.results) {
    process.stdout.write(
      `${item.caseId} #${item.repetition}: correctness ${item.score.correctness.toFixed(2)}, completeness ${item.score.completeness.toFixed(2)}, ${item.outcome}\n`,
    );
  }
  if (passed !== report.results.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error &&
    /^(OPENROUTER_API_KEY is required|OPENROUTER_MODEL must not enable automatic web search|OPENROUTER_REASONING_EFFORT is invalid|Unknown eval option:|Missing value for|Unknown or empty eval case selection|repeat must be)/.test(
      error.message,
    )
      ? error.message
      : error instanceof Error
        ? error.name
        : "unknown error";
  process.stderr.write(`Catalog eval failed: ${message}\n`);
  process.exitCode = 1;
});

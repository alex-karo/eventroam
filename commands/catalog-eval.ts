import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  runCatalogEvals,
  evalItemPassed,
  type EvalOptions,
} from "@/ingestion/evals/run";
import { evalGroups } from "@/ingestion/evals/selection";

type EvalRun = Awaited<ReturnType<typeof runCatalogEvals>>;
type EvalGroupResult = EvalRun["groups"][number];
type EvalItem = EvalGroupResult["results"][number];
type Output = (value: string) => void;

function setValueOption(options: EvalOptions, arg: string, value: string) {
  switch (arg) {
    case "--case":
      options.caseIds = [...(options.caseIds ?? []), value];
      break;
    case "--group": {
      const group = evalGroups.find((group) => group === value);
      if (!group) {
        throw new Error(`Unknown eval group: ${value}`);
      }
      options.groups = [...(options.groups ?? []), group];
      break;
    }
    case "--model":
      options.model = value;
      break;
    case "--label":
      options.label = value;
      break;
    case "--repeat":
      options.repeat = Number(value);
      break;
  }
}

function parseEvalArgs(args: string[]): EvalOptions {
  const options: EvalOptions = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--all":
        options.all = true;
        continue;
      case "--location-only":
        options.locationOnly = true;
        continue;
      case "--editor-only":
        options.editorOnly = true;
        continue;
    }
    if (
      !["--case", "--group", "--model", "--repeat", "--label"].includes(arg)
    ) {
      throw new Error(`Unknown eval option: ${arg}`);
    }
    const value = args[++index];
    if (!value?.trim() || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    setValueOption(options, arg, value);
  }
  return options;
}

function printMainScores(items: EvalItem[], output: Output) {
  for (const id of [
    "no-checked-errors",
    "required-completeness",
    "additional-completeness",
  ]) {
    const scores = items.flatMap((item) =>
      item.scores.filter((score) => score.scorerId === id),
    );
    const applicable = scores.filter(
      (score) => score.score !== null && !score.error,
    );
    const na = scores.filter((score) => score.notScorable).length;
    const mean = applicable.length
      ? (
          applicable.reduce((sum, score) => sum + score.score!, 0) /
          applicable.length
        ).toFixed(2)
      : "N/A";
    const incomplete = applicable.length + na !== items.length;
    output(
      `  ${id}: ${mean}; applicable ${applicable.length}, N/A ${na}${incomplete ? "; incomplete execution" : ""}\n`,
    );
  }
}

function printFailure(item: EvalItem, output: Output) {
  const value = item.output;
  if (value?.quality) {
    for (const check of value.quality.checks.filter(
      (check) => check.status !== "correct",
    )) {
      output(`    ${check.path}: ${check.status} — ${check.note}\n`);
    }
    for (const check of value.quality.conditions.filter(
      (check) => !check.passed,
    )) {
      output(`    ${check.path}: ${check.message}\n`);
    }
  } else if (value?.score) {
    for (const check of value.score.checks.filter((check) => !check.passed)) {
      output(`    ${check.path}: ${check.message}\n`);
    }
  }
  if (item.error || item.scores.some((score) => score.error)) {
    output("    execution: task or scorer failed\n");
  }
}

function printGroup(group: EvalGroupResult, output: Output) {
  const items = group.results;
  const passed = items.filter(evalItemPassed).length;
  const duration =
    (group.completedAt.getTime() - group.startedAt.getTime()) / 1000;
  output(
    `${group.group}: ${group.caseCount} cases, ${items.length} attempts; ${passed}/${items.length} passed; ${duration.toFixed(1)}s\n`,
  );
  output(
    `  experiment: ${group.experimentId}; name: ${group.name}; dataset: ${group.datasetId}; version: ${group.datasetVersion}\n`,
  );
  if (group.group === "main/pipeline") {
    printMainScores(items, output);
  }
  for (const name of ["completion", "correction", "preservation"]) {
    const selected = items.filter((item) => item.locationGroup === name);
    if (selected.length) {
      output(
        `  ${name}: ${selected.filter(evalItemPassed).length}/${selected.length} passed\n`,
      );
    }
  }
  for (const item of items) {
    const runId =
      item.output?.report?.runId ?? item.output?.runId ?? "unavailable";
    const passed = evalItemPassed(item);
    output(
      `  ${item.caseId} #${item.repetition}: ${passed ? "passed" : "failed"}; run ${runId}\n`,
    );
    if (item.output?.quality) {
      output(`    checked errors: ${item.output.quality.errorCount}\n`);
    }
    if (!passed) {
      printFailure(item, output);
    }
  }
}

async function executeCatalogEvalCommand(args: string[]) {
  const output = (value: string) => process.stdout.write(value);
  if (args.includes("--help") || args.includes("-h")) {
    output(
      "Usage: pnpm run catalog:eval [--all | --group GROUP | --editor-only | --location-only] [--case ID] [--model MODEL] [--repeat N] [--label LABEL]\nDefault: five main cases, one repetition. Groups: " +
        evalGroups.join(", ") +
        ".\nResults are saved as Mastra experiments. Inspect them in catalog:studio.\n",
    );
    return 0;
  }
  const run = await runCatalogEvals(parseEvalArgs(args));
  for (const group of run.groups) {
    printGroup(group, output);
  }
  return run.groups.every(
    (group) =>
      group.results.length === group.totalItems &&
      group.results.every(evalItemPassed),
  )
    ? 0
    : 1;
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
      const message =
        error instanceof Error &&
        /^(OPENROUTER_|Unknown eval|Unknown or incompatible|Use one of|Missing value for|repeat must be|(?:Main|Regression) case needs|Eval storage must)/.test(
          error.message,
        )
          ? error.message
          : "Evaluation setup failed";
      process.stderr.write(`Catalog eval failed: ${message}\n`);
      process.exitCode = 1;
    });
}

import { parseArgs } from "node:util";

export const catalogUsage = `Usage: npm run catalog -- <add|refresh|check> [options]
  add      --name <festival>
  refresh  --event <Event ID>
  check    --event <Event ID> ...
  --dry-run (default) | --apply
  --republish             Explicitly allow withdrawn records to publish
  --database <path>       Existing, migrated SQLite catalog
  --report <path>         Write the private JSON report
  --json                  Print JSON instead of a terminal summary
  --pages <n> --searches <n> --model-calls <n> --seconds <n>
  --help`;

export function parseCatalogOptions(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean" },
      name: { type: "string" },
      event: { type: "string", multiple: true },
      "dry-run": { type: "boolean" },
      apply: { type: "boolean" },
      republish: { type: "boolean" },
      database: { type: "string" },
      report: { type: "string" },
      json: { type: "boolean" },
      pages: { type: "string" },
      searches: { type: "string" },
      "model-calls": { type: "string" },
      seconds: { type: "string" },
    },
  });
  if (values.help) {
    return { help: true as const };
  }
  const [mode] = positionals;
  if (positionals.length !== 1 || !["add", "refresh", "check"].includes(mode)) {
    throw new Error("Choose add, refresh, or check.");
  }
  if (values.apply && values["dry-run"]) {
    throw new Error("Choose either --apply or --dry-run.");
  }
  const eventIds = [...new Set(values.event ?? [])];
  if (mode === "add") {
    if (!values.name?.trim()) {
      throw new Error("add requires --name.");
    }
    if (eventIds.length) {
      throw new Error("add does not accept record IDs.");
    }
  } else {
    if (values.name) {
      throw new Error("--name belongs to add.");
    }
    if (!eventIds.length) {
      throw new Error("Provide --event.");
    }
    if (mode === "refresh" && eventIds.length !== 1) {
      throw new Error("refresh requires one --event.");
    }
  }
  const limits = parseLimits(values);
  return {
    help: false as const,
    mode: mode as "add" | "refresh" | "check",
    name: values.name?.trim(),
    eventIds,
    dryRun: !values.apply,
    republish: values.republish ?? false,
    database: values.database,
    report: values.report,
    json: values.json ?? false,
    limits,
  };
}

function parseLimits(
  values: Partial<
    Record<"pages" | "searches" | "model-calls" | "seconds", string>
  >,
) {
  const limits: Partial<
    Record<"pages" | "searches" | "modelCalls" | "durationMs", number>
  > = {};
  for (const [flag, key, factor] of [
    ["pages", "pages", 1],
    ["searches", "searches", 1],
    ["model-calls", "modelCalls", 1],
    ["seconds", "durationMs", 1000],
  ] as const) {
    if (values[flag] !== undefined) {
      const number = Number(values[flag]);
      if (
        !Number.isSafeInteger(number) ||
        number < 0 ||
        !Number.isSafeInteger(number * factor)
      ) {
        throw new Error(`--${flag} must be a non-negative integer.`);
      }
      limits[key] = number * factor;
    }
  }
  return limits;
}

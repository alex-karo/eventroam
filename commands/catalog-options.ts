import { parseArgs } from "node:util";
import { addInputSchema } from "../src/ingestion/add-input";
import { eventIdSchema, refreshScopeSchema } from "../src/ingestion/invocation";

export const catalogUsage = `Usage: pnpm run catalog <add|refresh> [options]
  add      --input <description>
  refresh  --event <Event ID> ... [--scope full|current] (default full)
  --dry-run (default) | --apply
  --republish             Explicitly allow withdrawn records to publish
  --url <origin>          Local Studio URL (default http://127.0.0.1:4111)
  --json                  Print workflow summaries as JSON
  --help`;

export function parseCatalogOptions(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean" },
      input: { type: "string", multiple: true },
      scope: { type: "string" },
      event: { type: "string", multiple: true },
      "dry-run": { type: "boolean" },
      apply: { type: "boolean" },
      republish: { type: "boolean" },
      url: { type: "string" },
      json: { type: "boolean" },
    },
  });
  if (values.help) {
    return { help: true as const };
  }
  const [mode] = positionals;
  if (positionals.length !== 1 || (mode !== "add" && mode !== "refresh")) {
    throw new Error("Choose add or refresh.");
  }
  if (values.apply && values["dry-run"]) {
    throw new Error("Choose either --apply or --dry-run.");
  }
  const eventIds = [
    ...new Set(
      (values.event ?? []).map((value) => {
        const parsed = eventIdSchema.safeParse(value);
        if (!parsed.success) {
          throw new Error("Provide a valid --event ID.");
        }
        return parsed.data;
      }),
    ),
  ];
  if ((values.input?.length ?? 0) > 1) {
    throw new Error("Provide one --input note.");
  }
  const input = values.input?.[0];
  if (mode === "add") {
    if (!addInputSchema.safeParse(input).success) {
      throw new Error("add requires nonblank --input.");
    }
    if (eventIds.length) {
      throw new Error("add does not accept record IDs.");
    }
  } else {
    if (values.input !== undefined) {
      throw new Error("--input belongs to add.");
    }
    if (!eventIds.length) {
      throw new Error("Provide --event.");
    }
  }
  const scope = refreshScopeSchema.safeParse(values.scope ?? "full");
  if (!scope.success || (mode === "add" && values.scope !== undefined)) {
    throw new Error("--scope requires refresh and full or current.");
  }
  return {
    help: false as const,
    mode,
    scope: scope.data,
    input,
    eventIds,
    dryRun: !values.apply,
    republish: values.republish ?? false,
    url: studioOrigin(values.url),
    json: values.json ?? false,
  };
}

function studioOrigin(value = "http://127.0.0.1:4111") {
  const url = URL.parse(value);
  if (
    url?.protocol !== "http:" ||
    !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("--url must be a local Studio HTTP origin.");
  }
  return url;
}

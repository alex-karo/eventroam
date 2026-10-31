---
type: Guide
title: Ingestion tools
description: CLI research, Studio execution, saved history, and diagnostic commands.
status: stable
tags: [catalog, ingestion, operations]
---

# Ingestion tools

Use this guide to run ingestion and inspect results. Read the [ingestion process](ingestion-process.md) for source rules and catalog behavior.

## CLI research

Use the [local setup](development.md#local-setup) for runtime versions and dependencies. Set `OPENROUTER_API_KEY` in `.env`. The selected database must exist and be migrated; migrations supply the starter taxonomy needed for classification. `ppnpm run catalog --help` lists options.

For a separate research catalog, migrate it first:

```sh
DATABASE_PATH=./data/research.sqlite ppnpm run db:migrate
```

Then run research:

```sh
ppnpm run catalog add --name "Festival name" --database data/research.sqlite
ppnpm run catalog refresh --event EVENT_ID --database data/research.sqlite --report data/refresh.json
ppnpm run catalog refresh --event EVENT_ID --database data/research.sqlite --apply
```

`add` creates new Events; use `refresh` for existing ones. Refresh supports repeated `--event` and `--scope full|current`; each Event has an independent atomic attempt. Preview is the default and still needs a writable database: catalog changes roll back, while the private run report persists. `--apply` starts fresh research rather than applying a saved preview. Use `--republish` to permit withdrawn records to publish again.

See `.env.example` for current model defaults and execution limits. Set `OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`, or `OPENROUTER_SERVICE_TIER=standard` to override them. Flex can have higher latency and capacity errors. Optional `FIRECRAWL_KEY` enables the [source fallback](ingestion-process.md#find-and-read-sources). Use `--agent-steps` or `CATALOG_MAX_AGENT_STEPS` to change the model-step allowance. The last step is reserved for a final response. There is no application limit on total input context characters. Other CLI overrides include `--searches` and `--seconds`. Limits bound work, not exact spending.

The [ingestion guide](ingestion-process.md) explains source handling, fact selection, previews, publication, and reports. Research is model-led and can make factual mistakes. Inspect the report before deciding on an apply run. After interruption, start a fresh run against current state; already committed changes remain.

### Saved source evidence

Each ingestion run saves private canonical Markdown and separate evidence JSON under `data/ingestion-sources/<runId>/`. Set `CATALOG_SOURCE_DIRECTORY` to change the root. Relative paths resolve from the application root, independently of the process working directory. Markdown has application provenance frontmatter followed by the unchanged canonical page, including source metadata as source claims.

The workflow collection result contains the source list and artifact paths. There is no manifest file or opt-in capture flag. Reader failure and input-limit cases retain available Markdown. Storage failure stops dependent work. Files use private directory and file permissions.

Source artifacts have no automatic retention. Deleting workflow history does not delete them. Remove a run directory explicitly after it is no longer needed. Preserve files referenced by runs you still need to inspect. Hosted Studio must mount this directory on persistent private storage.

## Local Studio ingestion

Run `ppnpm run catalog:studio`, open `http://127.0.0.1:4111` in the built-in Browser, and choose Workflows → `catalog-ingestion`. Inspection needs no model credentials or catalog; execution needs the migrated `DATABASE_PATH` and OpenRouter settings from `.env`.

```json
{ "mode": "add", "name": "Festival name" }
```

```json
{
  "mode": "refresh",
  "eventId": "EVENT_ID",
  "scope": "full",
  "dryRun": false,
  "republish": false
}
```

The workflow form accepts one Event per refresh, with optional `scope: "full"|"current"` (default full). Add rejects scope and check is unsupported.

Preview is the default. Inspect intermediate results and the final report in the workflow view. Use native cancellation while a run is active; after interruption, start a fresh run. Per-step execution, resume, restart, and time travel are unsupported. See the [workflow steps](ingestion-process.md#workflow-steps) for the shared CLI/Studio lifecycle.

## Studio catalog assistant

Open Agents → `catalog-assistant` in Studio. Ask it to select Events, preview one to three Events, update a clear selection, or explain saved results. Follow-up references use the selected conversation. An explicit update request permits apply without a second confirmation. Unclear targets or write intent require clarification.

The assistant has two catalog tools: `query_catalog({sql, parameters?})` and `refresh_events({eventIds, scope?, dryRun?})`. It loads schema and report guidance from the catalog-sql filesystem skill through native Mastra skill tools. SQL reads need a migrated catalog but no provider key.

Chat uses the configured OpenRouter model by default. Native Studio model selection can use another provider and its credentials without an OpenRouter key. OpenRouter chat calls use the configured reasoning and service tier; explicit call options override those defaults. Other providers do not receive these defaults.

Refresh keeps its separate OpenRouter settings and key requirement. Inspection needs no model key.

Conversation memory is bounded; older messages can leave the active context while remaining stored. There are no embeddings or background model calls. See `src/mastra/catalog-assistant/memory.ts` for the current limits.

`CATALOG_CHAT_DATABASE_PATH` selects a separate SQLite file, default `data/mastra-chat.sqlite`. The local launcher resolves this path before Mastra changes its working directory. Retain it across restart for conversation history. The file and its SQLite sidecars must be separate from the catalog, workflow history, and DuckDB files. SDK shutdown closes all storage providers. Chat history can contain private catalog and report text.

Use `pnpm exec tsx src/test/studio-fixture.ts success` for an offline Studio fixture. It uses temporary storage and a deterministic provider, with no paid research. Its chat model tests the tool protocol, not production model reasoning. See the [chat limits and report examples](ingestion-process.md#studio-catalog-chat).

## Workflow history

CLI and Studio always save workflow snapshots, including intermediate results, to `CATALOG_WORKFLOW_DATABASE_PATH` (default `data/mastra-workflows.sqlite`). Relative paths use the project root. Use the same path for both commands and keep this store separate from other data files.

After a CLI run, start `ppnpm run catalog:studio` and open Workflows → catalog-ingestion → Recent runs. Inspection needs no catalog connection or model key. History supports inspection only; start a new run after interruption.

A history storage failure stops execution with `workflow_history_failed` and CLI exit code 1. Confirmed catalog writes and completed reports remain.

History has no automatic deletion. With Studio running, delete a completed entry with:

```sh
curl -X DELETE http://127.0.0.1:4111/api/workflows/catalog-ingestion/runs/EXECUTION_ID
```

To clear all history, stop Studio and other writers, then remove only the workflow SQLite file and its sidecars. Catalog data and reports remain. See the [diagnostics spec](../openspec/specs/operations/ingestion-diagnostics/spec.md) for the full history contract.

## Local trace inspection

Logging and tracing are independently opt-in and default off. Tracing supports apply, preview and evaluation, including injected dependencies. Mock calls do not invent tokens or costs. `CATALOG_LOG_LEVEL` accepts `debug`, `info` (default), `warn`, or `error`.

Close Studio before recording from a separate CLI process: DuckDB requires exclusive process ownership of its file.

```sh
CATALOG_LOGGING=true CATALOG_TRACING=true ppnpm run catalog refresh --event EVENT_ID --apply --report data/research-report.json
ppnpm run catalog:studio
```

In Studio, open Observability → Logs, Traces or Metrics. Both commands use `CATALOG_OBSERVABILITY_DATABASE_PATH`, defaulting to `data/mastra-observability.duckdb`. Use the durable runId to correlate records. The [ingestion guide](ingestion-process.md#execution-metrics) describes metric eligibility, recorded fields, cost semantics and privacy boundaries.

With Studio running, use the native Mastra CLI to inspect saved records without model credentials or a research run:

```sh
pnpm exec mastra api --url http://127.0.0.1:4111 trace list '{"page":0,"perPage":20}'
pnpm exec mastra api --url http://127.0.0.1:4111 log list '{"level":"error","page":0,"perPage":50}'
pnpm exec mastra api --url http://127.0.0.1:4111 metric aggregate '{"name":["mastra_model_total_input_tokens","mastra_model_total_output_tokens"],"aggregation":"sum"}'
```

Use `--schema` on a command to check its filter fields. Sum cost over total input/output metrics only; adding cache/reasoning detail costs can double count consumption.

`value` is the combined input/output token count; `estimatedCost`/`costUnit` carry the known model cost or estimate, not a complete bill. Add `filters.runId` to select a durable run. `POST /api/observability/metrics/breakdown` accepts the same names/aggregation and `groupBy:["entityId","model"]`. Raw `GET /api/observability/metrics` records expose runId, traceId, spanId and native cost metadata. Studio’s agent links from Metrics may preselect agent-root trace filters; this ingestion uses a generic catalog root, so clear those primitive filters to see its trace or correlate the IDs through the API.

Observability is best effort; incomplete or missing traces/metrics do not replace the durable report. Revisit flush/shutdown handling if missing traces or closed-store failures recur. Local stores have no automatic retention. To remove a disposable store, stop research and Studio first, then delete its DuckDB file and `.wal`; leave the catalog and reports intact.

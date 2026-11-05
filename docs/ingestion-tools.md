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

Use the [local setup](development.md#local-setup) for runtime versions and dependencies. Set `OPENROUTER_API_KEY` in `.env`. The selected database must exist and be migrated; migrations supply the starter taxonomy needed for classification. `pnpm run catalog --help` lists options.

For a separate research catalog, migrate it first:

```sh
DATABASE_PATH=./data/research.sqlite pnpm run db:migrate
```

Then run research:

```sh
pnpm run catalog add --input "Festival name or research note" --database data/research.sqlite
pnpm run catalog refresh --event EVENT_ID --database data/research.sqlite --report data/refresh.json
pnpm run catalog refresh --event EVENT_ID --database data/research.sqlite --apply
```

`add` creates new Events; use `refresh` for existing ones. Refresh supports repeated `--event` and `--scope full|current`; each Event has an independent atomic attempt. Preview is the default and still needs a writable database: catalog changes roll back, while the private run report persists. `--apply` starts fresh research rather than applying a saved preview. Use `--republish` to permit withdrawn records to publish again.

See `.env.example` for current model defaults and execution limits. Set `OPENROUTER_MODEL` or `OPENROUTER_REASONING_EFFORT` to override them. The service tier is omitted by default. Set `OPENROUTER_SERVICE_TIER=flex` to use Flex routing; it can have higher latency and capacity errors. Optional `FIRECRAWL_KEY` enables the [source fallback](ingestion-process.md#find-and-read-sources). Use `--agent-steps` or `CATALOG_MAX_AGENT_STEPS` to change the model-step allowance. The last step is reserved for a final response. There is no total input-context allowance across a run. Each serialized role input is limited to 400,000 UTF-16 code units. An oversized input fails explicitly; it is not shortened. Other CLI overrides include `--searches` and `--seconds`. Limits bound work, not exact spending.

The [ingestion guide](ingestion-process.md) explains source handling, fact selection, previews, publication, and reports. Research is model-led and can make factual mistakes. Inspect the report before deciding on an apply run. After interruption, start a fresh run against current state; already committed changes remain.

### Saved source evidence

Each ingestion run saves private canonical Markdown and separate evidence JSON under `data/ingestion-sources/<startedAt>_<runId>/sources/`. The folder starts with the run start time in UTC, with milliseconds and hyphens in place of time colons. For example: `2026-11-03T02-19-21.123Z_<runId>`. Sorting folder names orders new runs by start time. Reports and provenance keep the original run ID. Existing files stay at their recorded paths.

Set `CATALOG_SOURCE_DIRECTORY` to change the root. Relative paths resolve from the application root, independently of the process working directory. Markdown has application provenance frontmatter followed by the unchanged canonical page, including source metadata as source claims.

The workflow collection result contains the source list and artifact paths. There is no manifest file or opt-in capture flag. Reader failure and input-limit cases retain available Markdown. Storage failure stops dependent work. Files use private directory and file permissions.

Source artifacts have no automatic retention. Deleting workflow history does not delete them. Remove a run directory explicitly after it is no longer needed. Preserve files referenced by runs you still need to inspect. Hosted Studio must mount this directory on persistent private storage.

## Local Studio ingestion

Run `pnpm run catalog:studio`, open `http://127.0.0.1:4111` in the built-in Browser, and choose Workflows → `catalog-ingestion`. Inspection needs no model credentials or catalog; execution needs the migrated `DATABASE_PATH` and OpenRouter settings from `.env`.

```json
{ "mode": "add", "input": "Festival name, URL, pin, or other clues" }
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

## Studio catalog researcher

Open Agents → `catalog-researcher` to find possible Events, add a selected group, or read add progress by batch ID. `search_web({query})` uses Exa through OpenRouter with a shared search allowance and deadline for each chat execution. Search needs an OpenRouter key when called. Missing search credentials do not block job submission or saved status reads when chat uses another provider.

`add_events({inputs, dryRun?})` takes 1 to 200 complete descriptions, one per intended Event. Group several clues for the same Event and keep the full original note. A clear add request permits apply. Preview uses dryRun true and is the default. Search alone starts no jobs. Acceptance returns only batchId and acceptedCount. Use read-only query_catalog for progress and saved attempts. The researcher has no cancellation tool. Use catalog-assistant and the batch ID to cancel pending work.

All supplied text is search leads. The collector receives the full note, including line breaks and a final URL. Notes can exceed 500 characters and remain in private job and run input. A processing limit produces an explicit failure, without truncation or partial application. The verified Event name comes from inspected sources.

## Studio catalog assistant

Open Agents → `catalog-assistant` in Studio. Ask it to select Events, preview up to 200 Events, update a clear selection, or explain saved results. Follow-up references use the selected conversation. An explicit update request permits apply without a second confirmation. Unclear targets or write intent require clarification.

The assistant has three catalog tools: `query_catalog({sql, parameters?})`, `refresh_events({eventIds, scope?, dryRun?})`, and `cancel_batch({batchId})`. It loads schema and report guidance from the catalog-sql filesystem skill through native Mastra skill tools. SQL reads need a migrated catalog but no provider key.

Chat uses the configured OpenRouter model by default. Native Studio model selection can use another provider and its credentials without an OpenRouter key. OpenRouter chat calls use the configured reasoning and service tier; explicit call options override those defaults. Other providers do not receive these defaults.

Submission and inspection need no ingestion key. Studio uses its OpenRouter settings and credentials when it executes a job. Chat generation still needs its selected provider credentials.

Conversation memory is bounded; older messages can leave the active context while remaining stored. There are no embeddings or background model calls. See `src/mastra/catalog-assistant/memory.ts` for the current limits.

`CATALOG_CHAT_DATABASE_PATH` selects a separate SQLite file, default `data/mastra-chat.sqlite`. The local launcher resolves this path before Mastra changes its working directory. Retain it across restart for conversation history. The file and its SQLite sidecars must be separate from the catalog, workflow history, and DuckDB files. SDK shutdown closes all storage providers. Chat history can contain private catalog and report text.

Use `pnpm exec tsx src/test/studio-fixture.ts success` for an offline Studio fixture. It uses temporary storage and a deterministic provider, with no paid research. Its chat model tests the tool protocol, not production model reasoning. Both agents are registered in this fixture. See the [chat limits and report examples](ingestion-process.md#studio-catalog-chat).

## Background execution

Studio processes accepted jobs in its own server process. Run `pnpm run catalog:studio` locally or `pnpm run studio:start` after a production build. The catalog must already exist and be migrated. Startup and submission do not create or migrate it. Run one Studio server per catalog; there is no processor lock.

Chat submits a fixed selection of 1–200 distinct existing Event IDs in one transaction. Preview is the default; explicit update intent selects apply. Scope defaults to full; republish stays off. The response contains `batchId` and `acceptedCount`. Acceptance is not ingestion completion. Each Event gets one private `ingestion_jobs` row. Jobs store settings, queue state, and creation time. Attempts, timing, reports, and errors remain in `ingestion_runs`. Its nullable `job_id` links queued attempts; direct runs have no job association.

Add jobs store the full add_input with null event_id and scope. Refresh jobs store an Event ID and scope with null add_input. One batch has one operation and fixed preview settings. Submission validates the entire selection and saves it atomically.

Studio executes one queued job at a time through its registered `catalog-ingestion` workflow. The workflow form and queue use the same graph and storage providers. Queued runs appear in Recent runs. With tracing or logging enabled, Studio serves their diagnostics from its open DuckDB store.

Queue states are pending, running, done, and cancelled. Done means processing ended, including failure or validation before an attempt could start. It does not mean ingestion succeeded. Read attempt results separately. For add, a preview proposes creation. Apply creation needs a changed createEvent receipt, including when outcome is published. A confirmed duplicate skip differs from a declined creation or a failed candidate match. Missing reports remain unknown. Read item position and state by default. Select short note excerpts in SQL only when needed so long notes do not exhaust the 64 KiB result limit. Ordinary processing failures allow later jobs. Queue storage failures stop processing and make `GET /ingestion-queue` return `503 {"status":"unavailable"}`. A running loop returns `200 {"status":"running"}`. Missing catalog storage leaves Studio available for inspection. Fix the catalog and restart Studio to start the queue.

Use `query_catalog` to aggregate the full batch by job status before reading bounded details. Join runs by `job_id`, keeping every attempt distinct. Count jobs before joining: a restart can give one job several attempts. SQL keeps its 200-row and 64 KiB limits. Report truncated or missing evidence. Stored running state does not establish queue health.

If the acceptance response is lost, find recent batches through catalog SQL using the available time, Event IDs, and settings. Logs are not required. Ask for clarification if matches are ambiguous or evidence is incomplete. Do not automatically submit again. One validated selection consumes the current assistant execution even if its transaction fails; invalid input does not consume it.

An explicit cancellation request uses `cancel_batch` for a resolved batch. It cancels pending jobs together. Running and terminal jobs remain unchanged, including interrupted running jobs waiting for fresh execution. Cancelling chat or closing a browser tab does not cancel accepted jobs.

On SIGINT or SIGTERM, Studio stops taking jobs, cancels its active queued workflow, waits for cleanup, and then closes its stores. An interrupted job remains running. After restart, the loop takes pending and saved running jobs in queue order and starts each from the beginning. Each execution uses fresh workflow and attempt IDs. Earlier reports and committed changes remain. Research and paid calls can repeat, including when a report was saved before the job became done. Done and cancelled jobs do not restart. Stop the old Studio server before starting its replacement.

Jobs and runs remain in private catalog history without automatic expiry. The CLI and Studio workflow form still execute directly; the queue does not serialize those runs. Stop Studio before a separate CLI process opens its DuckDB file. See [Infrastructure](infrastructure.md#application-containers) for deployment and database transfers.

## Workflow history

CLI and Studio always save workflow snapshots, including intermediate results, to `CATALOG_WORKFLOW_DATABASE_PATH` (default `data/mastra-workflows.sqlite`). Relative paths use the project root. Use the same path for both processes and keep this store separate from other data files.

After a CLI run, start `pnpm run catalog:studio` and open Workflows → catalog-ingestion → Recent runs. Inspection needs no catalog connection or model key. History supports inspection only; start a new run after interruption.

A history storage failure stops execution with `workflow_history_failed` and CLI exit code 1. Confirmed catalog writes and completed reports remain.

History has no automatic deletion. With Studio running, delete a completed entry with:

```sh
curl -X DELETE http://127.0.0.1:4111/api/workflows/catalog-ingestion/runs/EXECUTION_ID
```

To clear all history, stop Studio and other writers, then remove only the workflow SQLite file and its sidecars. Catalog data and reports remain. See the [diagnostics spec](../openspec/specs/operations/ingestion-diagnostics/spec.md) for the full history contract.

## Local trace inspection

Local commands keep logging and tracing off by default. Compose enables both for Studio; each deployment flag can disable its output independently. Tracing supports apply, preview and evaluation, including injected dependencies. Mock calls do not invent tokens or costs. `CATALOG_LOG_LEVEL` accepts `debug`, `info` (default), `warn`, or `error`.

Close Studio before recording from a separate CLI process: DuckDB requires exclusive process ownership of its file.

```sh
CATALOG_LOGGING=true CATALOG_TRACING=true pnpm run catalog refresh --event EVENT_ID --apply --report data/research-report.json
pnpm run catalog:studio
```

In Studio, open Observability → Logs, Traces or Metrics. Both commands use `CATALOG_OBSERVABILITY_DATABASE_PATH`, defaulting to `data/mastra-observability.duckdb`. Hosted traces and metrics use the native workflow run ID. Trace metadata also contains the durable `ingestionRunId`; application logs and reports retain that durable ID. Standalone diagnostics use the durable run ID. The [ingestion guide](ingestion-process.md#execution-metrics) describes metric eligibility, recorded fields, cost semantics and privacy boundaries.

With Studio running, use the native Mastra CLI to inspect saved records without model credentials or a research run:

```sh
pnpm exec mastra api --url http://127.0.0.1:4111 trace list '{"page":0,"perPage":20}'
pnpm exec mastra api --url http://127.0.0.1:4111 log list '{"level":"error","page":0,"perPage":50}'
pnpm exec mastra api --url http://127.0.0.1:4111 metric aggregate '{"name":["mastra_model_total_input_tokens","mastra_model_total_output_tokens"],"aggregation":"sum"}'
```

Use `--schema` on a command to check its filter fields. Sum cost over total input/output metrics only; adding cache/reasoning detail costs can double count consumption.

`value` is the combined input/output token count; `estimatedCost`/`costUnit` carry the known model cost or estimate, not a complete bill. Add `filters.runId` to select a run using the diagnostic ID described above. `POST /api/observability/metrics/breakdown` accepts the same names/aggregation and `groupBy:["entityId","model"]`. Raw `GET /api/observability/metrics` records expose runId, traceId, spanId and native cost metadata. Studio’s agent links from Metrics may preselect agent-root trace filters; this ingestion uses a workflow root, so select the catalog-ingestion workflow or correlate the IDs through the API.

Observability is best effort; incomplete or missing traces/metrics do not replace the durable report. Revisit flush/shutdown handling if missing traces or closed-store failures recur. Local stores have no automatic retention. To remove a disposable store, stop research and Studio first, then delete its DuckDB file and `.wal`; leave the catalog and reports intact.

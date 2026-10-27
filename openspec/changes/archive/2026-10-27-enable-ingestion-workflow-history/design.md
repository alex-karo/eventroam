# Design

## Change size

Medium. Two execution hosts gain required storage, one dependency, and one file database.
Main risks are failure after catalog commits, stored content, provider lifetime, and reused execution IDs.
LibSQL compatibility needs the save/close/reopen check in task 1.1.

## Approach

Register the existing ingestion workflow with native workflow storage in CLI and Studio.
Mastra owns snapshots, queries, and UI. The application owns paths, providers, safe errors, attempt correlation, and execution guards.
Use the native schema and deletion API; no custom history index or UI is needed.
See the [proposal](proposal.md) for accepted policies and UI limits, and the [delta specs](specs/operations/ingestion-diagnostics/spec.md) for behavior.

## Contracts

- Add `CATALOG_WORKFLOW_DATABASE_PATH`, default `data/mastra-workflows.sqlite`. Resolve relative paths from the project root before Studio changes directory.
- Add `{ engineRunId, ingestionRunId }` to `initialize-run` output. Final summaries keep those IDs. Pending entries before valid initialization have no durable attempt association; invalid input creates no durable attempt.
- Keep native status separate from `researchStatus`, `editorStatus`, `locationStatus`, `outcome`, and `persistenceStatus`.
- Use bounded `workflow_history_failed` errors with known IDs. Keep `run_persistence_failed` for catalog report failures. A late history error gives nonzero CLI status and retains an already completed report.
- Enable intermediate snapshots; keep retries at zero and `autoRestartActiveRuns: false`. Reports, model contracts, and catalog schema stay unchanged.

## Architecture

### Storage and hosts

Add a shared storage module under `src/ingestion/runtime/` with a compatible pinned `@mastra/libsql` adapter.
Use `MastraCompositeStore`: workflows for CLI; workflows plus existing DuckDB observability for Studio.
The files remain separate: catalog holds facts/audit/reports, workflow storage holds native snapshots, and DuckDB holds optional observations.

Run shared file preflight before either diagnostic store opens.
Compare effective catalog (`--database` included), workflow, report, observability, and journal paths with existing canonical-path and inode-alias logic.
CLI preflight must precede the per-target catch and report writer, or a rejected collision could still overwrite history with a report.
No catalog migration or business constraint is needed.

`runCatalogResearch` keeps one workflow and invocation closure per Event.
Register it with a small host; close owned providers in `finally`. Batch targets reopen the same file with fresh IDs.
The catalog command keeps its loop. Help and invalid syntax open no workflow store.
Tests and evals use explicit temporary or in-memory stores; callers own injected providers.
The optional `createRunObservability` host cannot own required history: it is absent when logging and tracing are off.

`src/mastra/index.ts` owns Studio providers for the server lifetime; attempt cleanup must not close them.
`commands/catalog-studio.ts` passes an absolute workflow path. `commands/studio-start.ts` uses the same registration in production.
Keep catalog resolution lazy in `src/mastra/ingestion.ts`, so saved inspection needs no catalog or model credentials.
Set the Compose path to `/data/mastra-workflows.sqlite`; direct image use accepts the runtime setting.
Docker and standalone Studio builds use temporary storage, never owner files.
Trusted-network/public-origin rules and DuckDB process ownership remain unchanged.

### Execution guards

The existing HTTP guard rejects resume, restart, time travel, per-step execution, and caller-supplied state.
It checks saved and active IDs before native start/stream handlers, rejecting already-started IDs before a success response without changing history.
Keep native `create-run`: the installed SDK returns an existing entry without replacing its snapshot.

The workflow start boundary repeats the shared check for direct SDK calls:

1. Reserve the ID in the existing local map before any asynchronous check permits another local start.
2. After input validation, load the native pending snapshot. Persist `running` before creating `CatalogAttempt` or external work. Preserve other native fields and apply snapshot pruning and safe errors.
3. Await the write. A non-pending saved status means already started. On write failure, release the reservation without allocating an attempt; never reset a saved transition to pending.

This closes the crash window between durable attempt allocation and the SDK's first step snapshot.
A hook alone cannot reject native `/start` before its early response; HTTP guards alone do not protect SDK callers.
Use native history and existing attempt ownership, without a second lifecycle database or distributed scheduler.

### Storage failures and recovery

`CatalogAttempt` owns source sessions, active model calls, report finalization, and cleanup.
The host wires a small workflow control interface to storage and HTTP guards. The workflow exposes ID checks and recovery, not its mutable attempt map.

A failed snapshot write passes its execution ID and current candidate state to recovery, then propagates a content-free history error.
The candidate can contain confirmed writes absent from saved history. Use it and active attempt data; a saved-state fallback must not claim missing work succeeded.
Keep memoized finalization and cleanup: no duplicate report write or work replay. Leave a completed report unchanged.
The storage callback is needed because SDK failures can bypass terminal lifecycle callbacks.
CLI must inspect the engine result before returning its memoized report.
Awaiting callers receive late errors; native `/start` cannot change its early response. Saved inspection can remain stale.

### Saved content and cleanup

Keep current serializable state and results, including Location/geocoding observations, operations, writes, and reports.
Full source Markdown stays in the live session. Preserve allowed final model text.
Use native `pruneSnapshot` to omit all saved `requestContext`: native input accepts it, and SDK serialization removes only its own auth token.
Do not change live context or add content scanning, response redaction, or duplicate state schemas.
Apply existing safe error projections at storage boundaries.

Document `DELETE /api/workflows/catalog-ingestion/runs/:runId` for completed entries and reset with all writers stopped.
Deletion removes ID-check evidence; no permanent used-ID registry is added.

## Simpler options

The owner retained CLI and intermediate history. Studio-only would lose ordinary CLI history; terminal-only would lose interrupted progress.
Native storage avoids a catalog history table, exporter, and retention scheduler. The trade-off is duplicated data and growth until manual cleanup.

## Risks and validation

Use existing offline workflow, command, transport, and process fixtures with temporary stores.
The [tasks](tasks.md) assign focused checks: path collisions before report writing, failed writes around commits, crash windows and SDK reuse, stored-content sentinels, CLI-to-Studio reopen, deletion, and Compose recreation.
Keep optional-observability failure coverage. Replace the current saved-run 404 assertion with persistence checks.
Use the built-in Browser for offline UI inspection; no paid research or shell Chrome launch is needed.

Update `.env.example`, `docs/development.md`, `docs/ingestion-process.md`, and `docs/project-structure.md` within the owning task groups.
The document set is unchanged, so the index needs no new entry.

# Design

## Context

See proposal.md for motivation. Ingestion currently creates a six-step graph per CLI invocation; Studio registers only trace storage. Installed Mastra 1.74 supports registered graphs, run-scoped IDs, cancellation signals and lifecycle hooks. Hook errors are swallowed, so report persistence needs an explicit step.

## Goals / Non-Goals

**Goals:** Share CLI/Studio execution with visible phases and isolated resources.

**Non-Goals:** A new execution framework, hosted jobs, replay, migrations or custom report/cancellation UI.

## Decisions

### 1. One graph, explicit step data

Register `catalog-ingestion` with this shared graph:

```text
initialize-run → load-context → read-initial-source → research-festival
  → prepare-candidate → apply-catalog-item → build-report → finalize-run
```

Steps read and update serializable context, source reads, research output, prepared operations, receipts and reports in native Mastra workflow state. A server-owned attempt retains only dependencies, budget, source session, trace and terminal resource ownership. The registry maps engine IDs to owned resources; no second accumulated-data checkpoint exists. Each step body owns its phase operation and commits state before returning. Installed Mastra buffers setState until successful step completion. A throwing interrupted phase therefore finalizes its available local data before propagating a safe error; an unserializable state/report uses the same local fallback. Terminal hooks consume their supplied final state for failures/cancellation outside a phase. Preserve existing handled-failure and fatal-error statuses; do not mutate state behind setState.

Admit each invocation before step work. Reject duplicate active IDs; hooks may clean up only their own attempt. Keep credentials, configuration and live resources outside Mastra input/state/output. Research data is inspectable in local Studio. CLI retains `runCatalogResearch(requested, deps)`, fixture injection and caller-owned connection semantics. Return its full result from the attempt when practical; add a completion channel only if required by the verified API. Retain the catalog-generated ingestion ID separately from the engine ID.

### 2. Explicit persistence, shared cleanup

Initialization validates input/configuration and the existing migrated catalog, then creates the durable running row before external work. Close acquired resources on setup failure. Unexpected phase errors record safe failure state and skip further research/writes; existing report builders retain accounting and any confirmed commit.

The final step persists once and returns a bounded summary, calling the attempt's idempotent cleanup in `finally`. Terminal hooks use the same cleanup and recover failures/cancellation that bypass finalization. They must not retry a failed final update or hide it behind successful completion. Preserve typed CLI persistence errors and safe Studio `run_persistence_failed` errors; failed persistence leaves the row running and committed writes intact.

Compose Mastra's `abortSignal` with the research deadline, propagate cancellation where supported and check before writing. Wait for active work to settle before cleanup. Forced termination keeps existing unknown-completion semantics.

### 3. Small Studio boundary

State is server-initialized. The workflow uses a broad JSON-object master schema with no advertised initial-state fields; steps validate their concrete state schema. This avoids Studio treating children of an omitted optional state object as required. The execution guard rejects caller-supplied initialState.

Use strict input: mode, name/eventId, dryRun=true and republish=false; one target, fixed actor `catalog-research`, environment-provided settings. Return both run IDs, mode, statuses, Event ID, counts, known usage and safe error codes. Full version-2 reports remain durable in `ingestion_runs` and are visible in intermediate workflow data.

Load execution dependencies lazily. Resolve catalog and trace paths before Mastra changes working directory; check the catalog exists before opening it. Keep loopback binding and shared trace inspection independent of attempt cleanup.

Disable retries, snapshots and automatic restart. Reject resume/restart/time travel and `perStep: true` on every start/stream variant before allocation. Per-step mode can pause after initialization without terminal hooks. Revalidate execution entry so callers cannot bypass initialization.

### 4. Preserve existing observability

Preserve main’s explicit apply-only trace fields and independently configurable selected Pino application logs. Keep the workflow SDK logger and automatic export disabled; registration adds no unsanitized exporter. Add both run IDs and safe cancellation/workflow/persistence terminal codes. Studio attempts reuse its initialized DuckDB handle: flush/shutdown owned observations without closing shared storage. CLI owns and closes its store as before. Dry-run progress comes from Studio steps; optional application logging remains available.

### 5. Use Mastra for agent limits

Remove the page-count cap from source reads, candidate preparation, prompts and configuration; keep page counts as observations. Retain search-count, traversal-depth, page-byte, search-result and input-context limits. Remove the prompt's separate four-page target so it does not silently retain the removed cap.

Use Mastra `maxSteps` for agent iterations and `modelSettings.timeout.totalMs` for generation, passing the remaining attempt time. Replace the hand-written generation timer while retaining the attempt deadline for initial reads, discovery and retry backoff; final report persistence/cleanup must still run after research expires. Compose owner cancellation with generation cancellation. Native timeout errors remain `limit_reached`, with known usage retained.

Replace the ordinary-call cap with a clearly named agent-step setting. Mastra iterations are not a total request or spending limit: discovery remains separately bounded by searches. Retain the existing provider_unavailable-only retry policy (three bounded backoffs, no tool replay), including capacity allowance for unavailable attempts through the existing retry tracking and a bounded iteration allowance. Do not retain a second general model-call limiter or silently convert capacity failures into loss of ordinary research capacity.

Keep model-call/page counts, token usage and reported costs as accounting. Update configuration, prompt projections, report budget metadata and consumers coherently, preserving version-2 historical report readability; no database migration. Test the real agent loop with an offline provider to verify iteration exhaustion, native timeout classification/usage, unavailable retries and reads beyond the former page cap.

## Risks / Trade-offs

- Shared registration leaks state → overlap and duplicate-ID ownership tests.
- Hooks hide persistence errors → explicit final step and real-server fault injection.
- Research data is visible in local Studio → inspect transport for accidental credentials/resources; retain safe exception messages, stacks and causes.
- Cancellation closes resources too early → await active work; test before writing and after commit.
- Concurrent writes conflict → existing optimistic versions and atomic rollback; no automatic write retry.

## Migration Plan

No migration or dependency upgrade. Extract the shared attempt, register the graph, then verify CLI parity and Studio API/UI with disposable catalogs and an offline provider. Update owning specs and guides after implementation. Rollback restores inspection-only registration.

## API Evidence

- Installed `@mastra/core/dist/docs/references/reference-workflows-workflow.md`: lifecycle, snapshot and restart options.
- Installed `@mastra/core/dist/workflows/step.d.ts`: runId, abortSignal, state and setState; workflow-state docs and installed default-engine source verify buffered updates and final hook state.
- Installed `@mastra/core/dist/docs/references/docs-server-middleware.md`: route guards.
- [Workflow reference](https://mastra.ai/reference/workflows/workflow). Installed package definitions take precedence.

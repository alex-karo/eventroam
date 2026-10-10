# Design

## Context

See proposal.md for motivation. Ingestion currently creates a six-step graph per CLI invocation; Studio registers only trace storage. Installed Mastra 1.74 supports registered graphs, run-scoped IDs, cancellation signals and lifecycle hooks. Hook errors are swallowed, so report persistence needs an explicit step.

## Goals / Non-Goals

**Goals:** Share CLI/Studio execution with visible phases and isolated resources.

**Non-Goals:** A new execution framework, hosted jobs, replay, migrations or custom report/cancellation UI.

## Decisions

### 1. One graph, one attempt object

Register `catalog-ingestion` with this shared graph:

```text
initialize-run → load-context → read-initial-source → research-festival
  → prepare-candidate → apply-catalog-item → build-report → finalize-run
```

Extract existing operations into one server-owned attempt object holding dependencies, budget, source session, trace, intermediate results and report. Steps call its operations. A small workflow-owned registry maps engine run IDs to attempts; it only handles lookup and ownership. Avoid separate lifecycle managers or a generic execution framework.

Admit each invocation before step work. Reject duplicate active IDs; hooks may clean up only their own attempt. Keep resources and private results outside Mastra input/state/output. CLI retains `runCatalogResearch(requested, deps)`, fixture injection and caller-owned connection semantics. Return its full result from the attempt when practical; add a completion channel only if required by the verified API. Retain the catalog-generated ingestion ID separately from the engine ID.

### 2. Explicit persistence, shared cleanup

Initialization validates input/configuration and the existing migrated catalog, then creates the durable running row before external work. Close acquired resources on setup failure. Unexpected phase errors record safe failure state and skip further research/writes; existing report builders retain accounting and any confirmed commit.

The final step persists once and returns a bounded summary, calling the attempt's idempotent cleanup in `finally`. Terminal hooks use the same cleanup and recover failures/cancellation that bypass finalization. They must not retry a failed final update or hide it behind successful completion. Preserve typed CLI persistence errors and safe Studio `run_persistence_failed` errors; failed persistence leaves the row running and committed writes intact.

Compose Mastra's `abortSignal` with the research deadline, propagate cancellation where supported and check before writing. Wait for active work to settle before cleanup. Forced termination keeps existing unknown-completion semantics.

### 3. Small Studio boundary

Use strict input: mode, name/eventId, dryRun=true and republish=false; one target, fixed actor `catalog-research`, environment-provided settings. Return both run IDs, mode, statuses, Event ID, counts, known usage and safe error codes. Full version-2 reports stay in `ingestion_runs`.

Load execution dependencies lazily. Resolve catalog and trace paths before Mastra changes working directory; check the catalog exists before opening it. Keep loopback binding and shared trace inspection independent of attempt cleanup.

Disable retries, snapshots and automatic restart. Reject resume/restart/time travel and `perStep: true` on every start/stream variant before allocation. Per-step mode can pause after initialization without terminal hooks. Revalidate execution entry so callers cannot bypass initialization.

### 4. Extend existing tracing minimally

Keep sanitized apply-only traces and silent SDK logging; prevent registration from adding an unsanitized exporter. Add the two run IDs and a bounded terminal code distinguishing cancellation, workflow failure and persistence failure. Retain existing outcomes and best-effort flush/shutdown behavior; introduce no new span hierarchy. Dry-run progress comes from Studio steps.

## Risks / Trade-offs

- Shared registration leaks state → overlap and duplicate-ID ownership tests.
- Hooks hide persistence errors → explicit final step and real-server fault injection.
- Disabled snapshots do not prove privacy → inspect actual transport/storage/traces, including error messages, stacks and causes.
- Cancellation closes resources too early → await active work; test before writing and after commit.
- Concurrent writes conflict → existing optimistic versions and atomic rollback; no automatic write retry.

## Migration Plan

No migration or dependency upgrade. Extract the shared attempt, register the graph, then verify CLI parity and Studio API/UI with disposable catalogs and an offline provider. Update owning specs and guides after implementation. Rollback restores inspection-only registration.

## API Evidence

- Installed `@mastra/core/dist/docs/references/reference-workflows-workflow.md`: lifecycle, snapshot and restart options.
- Installed `@mastra/core/dist/workflows/step.d.ts`: runId and abortSignal.
- Installed `@mastra/core/dist/docs/references/docs-server-middleware.md`: route guards.
- [Workflow reference](https://mastra.ai/reference/workflows/workflow). Installed package definitions take precedence.

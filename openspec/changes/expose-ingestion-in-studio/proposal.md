# Proposal

## Why

Ingestion now uses explicit Mastra steps, but its workflow is constructed inside each CLI invocation and cannot be selected in Studio. The owner should be able to inspect the graph and start the same research process from the local Studio interface.

## What Changes

- Register a reusable `catalog-ingestion` workflow with visible research and lifecycle steps in local Mastra Studio.
- Provide an input form for one `add`, `refresh`, or `check` target, defaulting to dry-run and allowing explicit apply.
- Share one attempt object and phase implementations with the CLI; use a small execution registry and one idempotent cleanup path.
- Return a bounded result summary and durable ingestion run ID in Studio. Keep complete private reports in the existing catalog run records.
- Load execution dependencies lazily so graph and trace inspection still works without model credentials or a catalog database.
- Preserve atomic writes, trace privacy, accounting and failure behavior; reject per-step execution and workflow replay before allocating attempt resources.
- Extend existing traces only with run ID correlation and safe terminal codes; verify engine error privacy through Studio transport.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Permit owner-initiated execution through local Studio, replace its inspection-only restriction, and define input, result, lifecycle and replay boundaries.

## Impact

Builds on the completed `use-mastra-ingestion-workflow` refactor. Affects `src/ingestion/workflow.ts`, extracted phase/lifecycle helpers, `src/mastra/index.ts`, `commands/catalog-studio.ts`, tests, and ingestion/development documentation. Uses the installed Mastra packages; no database migration or provider/model change is planned.

This covers the existing loopback Studio launched by `npm run catalog:studio`. Hosted execution, scheduling, batch Studio jobs, resumable/time-travel execution, a custom report browser, and new cancellation controls remain outside scope. Existing CLI multi-target checks and reports remain available.

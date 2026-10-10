# Proposal

## Why

Ingestion now uses explicit Mastra steps, but its workflow is constructed inside each CLI invocation and cannot be selected in Studio. The owner should be able to inspect the graph and start the same research process from the local Studio interface.

## What Changes

- Register a reusable `catalog-ingestion` workflow with visible research and lifecycle steps in local Mastra Studio.
- Provide an input form for one `add`, `refresh`, or `check` target, defaulting to dry-run and allowing explicit apply.
- Use native Mastra workflow state for accumulated serializable research results; keep only runtime resources in a small execution registry.
- Return a bounded result summary and durable ingestion run ID in Studio. Expose intermediate research and complete reports in local Studio; retain durable reports in catalog run records.
- Load execution dependencies lazily so graph and trace inspection still works without model credentials or a catalog database.
- Preserve atomic writes, trace privacy, accounting and failure behavior; reject per-step execution and workflow replay before allocating attempt resources.
- Remove the page-count cap and use Mastra agent iteration/time controls for shared CLI/Studio research; retain search/depth/size safeguards, provider retry policy and usage accounting.
- Preserve existing Pino logging and DuckDB observability from main; extend traces with run ID correlation and safe terminal codes, share Studio storage ownership and verify engine error privacy through transport.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Permit owner-initiated execution through local Studio, replace its inspection-only restriction, define input, result, lifecycle and replay boundaries, and simplify research budget enforcement.

## Impact

Builds on the completed `use-mastra-ingestion-workflow` refactor. Affects `src/ingestion/workflow.ts`, extracted phase/lifecycle helpers, `src/mastra/index.ts`, `commands/catalog-studio.ts`, research budget/configuration, source adapters, tests, and ingestion/development documentation. Uses the installed Mastra packages; no database migration or provider/model change is planned.

This covers the existing loopback Studio launched by `npm run catalog:studio`. Hosted execution, scheduling, batch Studio jobs, resumable/time-travel execution, a custom report browser, and new cancellation controls remain outside scope. Existing CLI multi-target checks and reports remain available.

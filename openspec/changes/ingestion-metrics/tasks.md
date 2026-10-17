# Tasks

## 1. Persist safe native metrics

- [x] 1.1 Update span projection for native nested usage, model/provider, selected cost context and stable agent/tool ownership. Reuse the known-entity mapping while preserving explicit trace labels and the unknown-agent fallback. Retain only provider-reported source and safe pricing ID in cost metadata. Verify offline research/editor fields across start/update/end and content exclusions.
- [x] 1.2 Deliver eligible-run metrics through the existing exporter with technical-name/value validation and safe context selection, without a metric-name allowlist. Verify tracing-only persistence, ineligible/logging-only rejection including direct emission, cached/spanless contexts, a new metric name, real run/span correlation and forbidden-content exclusion after DuckDB reopen.
- [x] 1.3 Verify native aggregate and agent/model breakdown queries after reopening offline research/editor records. Cover reported generation cost exactly once, zero, missing step cost with pricing fallback, missing pricing and cache/reasoning subsets in adjacent observability integration tests.
- [x] 1.4 Document metric eligibility, native coverage, safe fields and cost/report differences in the ingestion guide. Keep setup and total-token query examples in the development guide; update project structure for metric ownership. Verify the query against fixture data and run `npm run docs:check`.

## 2. Simplify application observations

- [x] 2.1 Remove timing-only variables and `durationMs` fields from research model-step and readPage/searchWeb tool logs. Verify logging-only and traced fixtures retain selected start/result events, commentary, reasoning and context; budget/retry counters and whole-run report duration remain correct.
- [x] 2.2 Consolidate write observation projection for logs and tracing using existing writer lifecycle evidence. Remove premature unchanged state during validation. Verify committed counts and matching dispositions for no writer call, no-op, preview, rollback, unknown completion and post-commit reporting failure in workflow/logging/tracing tests.
- [x] 2.3 Update the ingestion guide and project structure for operation timing and shared write observations. Document the removed log field and preserved independent logging behavior; run `npm run docs:check`.

## 3. Verify execution and inspection together

- [x] 3.1 Extend CLI/Studio offline execution coverage to show metrics survive exit/reopen and repeated Studio attempts keep the shared store usable. Exercise cancellation and metric export/flush failures; verify durable report v5, known accounting, catalog outcome and exit behavior match executions without metrics.
- [x] 3.2 Inspect saved Metrics through local Studio in the built-in Browser using disposable fixture data. Verify agent/model breakdowns, latency and token/cost views, and matching trace/run IDs through the inspection API. Record UI evidence and any actual limitation in service build progress; run `npm run docs:check`.
- [x] 3.3 After implementation is complete, synchronize this delta into the owning main spec and verify `npm run openspec:validate`. Run the ingestion/observability/Studio regression suites and `npm run type-check`, `npm run lint`, `npm run deps:check`, `npm run format:check` and `npm run docs:check`; resolve failures attributable to the change.

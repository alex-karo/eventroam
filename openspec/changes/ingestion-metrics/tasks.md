# Tasks

## 1. Persist native metrics

- [x] 1.1 Retain selected native usage, model/provider, cost context and status fields without application validation or nested projection. Preserve SDK span types and entity context without a separate registry or unknown-type substitution; retain explicit application trace labels and content exclusions. Remove obsolete malformed-field tests and reuse offline research/editor and span lifecycle coverage without adding tests.
- [x] 1.2 Forward eligible-run metric events directly through the existing exporter, relying on native context propagation without application metric validation or projection. Verify tracing-only persistence, ineligible/logging-only rejection including direct emission and native run/span correlation in existing tests after DuckDB reopen. Remove obsolete arbitrary-metric sanitization/validation tests; add no new tests for this simplification.
- [x] 1.3 Verify native aggregate and agent/model breakdown queries after reopening offline research/editor records. Cover reported generation cost exactly once, zero, missing step cost with pricing fallback, missing pricing and cache/reasoning subsets in adjacent observability integration tests.
- [x] 1.4 Document metric eligibility, native coverage, context propagation and cost/report differences in the ingestion guide. Keep setup and total-token query examples in the development guide; update project structure for metric ownership. Verify the query against fixture data and run `npm run docs:check`.

## 2. Simplify application observations

- [x] 2.1 Remove timing-only variables and `durationMs` fields from research model-step and readPage/searchWeb tool logs. Verify logging-only and traced fixtures retain selected start/result events, commentary, reasoning and context; budget/retry counters and whole-run report duration remain correct.
- [x] 2.2 Remove the write-observation helper/type, transaction-disposition/count fields and their state updates from workflow, logging and tracing. Retain ordinary completion/error events, writer results, receipts, transaction/dry-run behavior and report accounting. Remove helper-only tests and obsolete assertions; adapt existing regression tests without adding tests.
- [x] 2.3 Update the ingestion guide and project structure for native operation timing and removal of transaction summaries. Document removed diagnostic fields and the loss of a separate post-write reporting-failure summary; retain independent logging behavior and run `npm run docs:check`.

## 3. Verify execution and inspection together

- [x] 3.1 Extend CLI/Studio offline execution coverage to show metrics survive exit/reopen and repeated Studio attempts keep the shared store usable. Exercise cancellation and metric export/flush failures; verify durable report v5, known accounting, catalog outcome and exit behavior match executions without metrics.
- [x] 3.2 Inspect saved Metrics through local Studio in the built-in Browser using disposable fixture data. Verify agent/model breakdowns, latency and token/cost views, and matching trace/run IDs through the inspection API. Record UI evidence and any actual limitation in service build progress; run `npm run docs:check`.
- [x] 3.3 After implementation is complete, synchronize this delta into the owning main spec and verify `npm run openspec:validate`. Run the ingestion/observability/Studio regression suites and `npm run type-check`, `npm run lint`, `npm run deps:check`, `npm run format:check` and `npm run docs:check`; resolve failures attributable to the change.

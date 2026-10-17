# Design

## Change size

Medium. The exporter, span sanitization and operation logs share run context and failure handling. The observable changes are new local metric records and removal of operation-log duration fields and transaction-disposition/count summaries from logs and traces. No dependency upgrade, catalog migration or report-version change is needed. Persistence and Studio display require integration verification.

## Approach

Use the existing Mastra observability pipeline for the behavior in the [delta spec](specs/catalog/source-workflow/spec.md). Enable metrics for the same real apply runs that currently trace. Keep `CATALOG_TRACING`, `CATALOG_LOGGING` and the existing DuckDB path. The exporter remains responsible for delivery. The application projects span fields before native metric extraction; metric events use the SDK context without a separate application projection.

The installed versions are core 1.74.0, observability 1.18.4 and DuckDB 1.13.0. Inspection and a temporary-store probe established that:

- `ResearchObservabilityExporter.onMetricEvent()` currently discards every metric.
- Mastra extracts automatic metrics after span output processors run. Enabling export alone saves durations and total tokens, but loses model/provider, costs and detailed usage under the current processor.
- The installed SDK supports provider-reported OpenRouter costs and pricing estimates. DuckDB supports raw metrics, aggregates, breakdowns, time series and percentiles.

Reuse those capabilities. Do not add an application metric accumulator, custom queue or replacement pricing implementation.

## Contracts

### Eligibility and metric coverage

`CATALOG_TRACING=true` plus an apply run without an injected candidate generator enables metrics. Logging remains independent. Attempts with tracing off or ineligible emit no metrics, including manually emitted SDK events reaching the application exporter. They do not open a store unless logging requires it.

Metric names are not enumerated or validated by the application; eligible SDK metric events pass directly to the native exporter. Current ingestion produces native agent/model/tool duration and token observations, with the SDK's technical status labels and cost context. The custom catalog root and initial-source spans are currently `GENERIC`; they do not automatically become workflow/tool duration metrics. Keep them as they are. Native generation duration also differs from the removed per-step log timer. Whole-ingestion duration stays in the durable report.

### Span fields and native metric context

Replace the flat tracing-only `tokenUsage()` shape with a small projection of the installed `UsageStats` type. Preserve finite nonnegative input/output totals and supported nested input/output details. Preserve safe provider, configured/response model and incomplete-usage flag. Pass the SDK's native `costContext`, including `costMetadata`, through unchanged. Rely on SDK construction rather than independently validating or sanitizing manually supplied cost context. Native metric extraction may add its own accounting details.

Preserve the entity IDs, types and names supplied by the SDK from agent/tool configuration and inherited by child spans. Do not maintain a second entity registry or substitute an agent for an unknown entity. Keep explicit application trace labels; other agent/tool display names use their SDK entity names and other operation names use the span type. The SDK carries run/trace/span and entity/parent/root context into metrics. Group by `entityId` and `model` to identify the responsible agent.

Replace the metric no-op with an eligibility check and direct native export. Do not validate or rewrite metric names, values, labels, metadata, correlation or cost context in the application exporter. Arbitrary direct, cached or spanless metric events have no separate application sanitization guarantee or added run context. Retain the existing content-free export-failure diagnostics.

### Cost semantics and stored data

Let the SDK choose a complete provider-reported generation cost or an available pricing estimate. Preserve the distinction in saved cost context. Preserve zero, missing cost and incomplete usage. Aggregated cost examples select total input/output token metrics; adding cache/reasoning subset costs would double count consumption.

The report's known-cost subtotal and metric cost may differ after incomplete provider reporting. Direct discovery/search charges also remain outside native model metrics. Keep `research/agent/usage.ts`, `report.ts`, report v5, scalar run-statistic columns and their current semantics. No report reads metrics back from DuckDB.

Existing DuckDB data remains in place. Native storage initialization owns metric tables. New runs append metrics; historical spans/reports are not converted or backfilled. There is no compatibility alias for removed log fields.

Eventroam verifies saved records, correlation and total-token aggregate/breakdown queries against reopened offline research/editor data. Other native SDK query methods, including time series and percentiles, remain available without separate application guarantees or synthetic query tests.

## Architecture

### Delivery and lifecycle

The existing flow becomes:

```text
eligible run → native spans → safe span projection → native metric extraction
                                                    ↓
                                                storage exporter → DuckDB
```

CLI attempts retain owned-store cleanup. Studio attempts retain borrowed-store cleanup. Reuse the existing bounded flush before shutdown and failure isolation. Do not close Studio's store from an attempt or add a second observability instance for metrics.

### Remove duplicated observations

Remove `modelStarted` and its per-step `durationMs` from research logging. Remove the local start timestamps used only for `durationMs` in `read-page/tool.ts` and `search-web/tool.ts`. Retain start/outcome events, selected results, commentary/reasoning, step/attempt context and log timestamps. Keep budget deadlines, model-call counts, retry/iteration counters and run duration because they govern execution or required reporting. Logging-only users retain events but lose the explicit per-operation duration field.

Remove `writeObservation()`, `WriteDisposition`, `writeState` and `committedOperationCount` from application logs and trace output. Remove the associated assignments and helper arguments rather than replacing them with logger context or a new state machine. Retain ordinary write completion/error events, writer results, `writeFailed`, operation receipts and report construction. Transactions, dry-run rollback and report v5 remain unchanged. A reporting failure after a write no longer promises a separate commit/count summary in telemetry. Existing Event/Edition trace labels and confirmed Edition details remain.

Keep descriptive trace labels, the application logging bridge, selected diagnostics and the finalization owner. Metrics do not replace those functions. The installed Pino export path still omits child bindings, and unrestricted SDK logs remain excluded.

## Simpler options

Removing only the metric no-op is insufficient: the probe saved no model identity, cost or detailed tokens. Expanding the span projection is necessary; a second projection of metric events is not.

An independent metric switch would require separating span recording from span persistence. Sharing tracing eligibility avoids that extra lifecycle. Custom outcome, ingestion-duration and search-cost metrics are deferred; existing reports retain those facts.

Removing durable usage accounting would make required reports depend on optional telemetry and change partial-cost semantics. Keep the accumulator. Stable trace display names could remove label-formatting code, but would change the Event/Edition trace-list contract and are outside this change.

## Risks and validation

- Exercise real research/editor SDK execution with offline model fixtures. Verify safe fields after creation, updates and completion, rather than testing only fabricated span shapes.
- Retain existing span content-exclusion checks and inspect native metrics from offline execution after reopen. Verify errors remain content-free and eligibility also rejects direct metric emission on logging-only runs. Remove tests for the retired arbitrary-metric sanitization and validation contract; add no new tests for this simplification.
- Check reported costs, zero, missing step costs, missing pricing and cache/reasoning subsets. Query total-token costs once and retain independent report accounting on failure/cancellation.
- Compare grouped research/editor observations, run/trace correlation and native technical status with host retrieval/editor outcomes. Do not promote a technical success into catalog success.
- Remove helper-only tests and assertions for retired write-state/count fields. Retain existing workflow, transaction, dry-run, report and failure coverage without adding tests. Verify ordinary write/error events and available trace results remain intact.
- Exercise owned and shared storage, flush failure, repeated Studio attempts and database reopen. Use the built-in Browser to verify saved Metrics in Studio; API-only success is insufficient to claim UI verification.
- Keep metric semantics, eligibility and native context behavior in the ingestion guide; keep setup, query examples and the Studio filter workaround in the development guide. Update project structure with timing and metric ownership. Run focused regression suites plus the project's type, lint, dependency, documentation and OpenSpec checks. Synchronize the owning main spec only after implementation is complete.

References: [Metrics overview](https://mastra.ai/docs/observability/metrics/overview), [automatic metrics](https://mastra.ai/reference/observability/metrics/automatic-metrics), and [metric queries](https://mastra.ai/reference/observability/metrics/queries). Installed SDK code and types govern implementation when remote documentation differs.

# Design

## Change size

Medium. The exporter, span sanitization, operation logs and write observations share run context and failure handling. The observable changes are new local metric records, removal of operation-log duration fields and consistent write disposition. No dependency upgrade, catalog migration or report-version change is needed. Persistence and Studio display require integration verification.

## Approach

Use the existing Mastra observability pipeline for the behavior in the [delta spec](specs/catalog/source-workflow/spec.md). Enable metrics for the same real apply runs that currently trace. Keep `CATALOG_TRACING`, `CATALOG_LOGGING` and the existing DuckDB path. The exporter remains responsible for delivery, and the application remains responsible for choosing safe fields.

The installed versions are core 1.74.0, observability 1.18.4 and DuckDB 1.13.0. Inspection and a temporary-store probe established that:

- `ResearchObservabilityExporter.onMetricEvent()` currently discards every metric.
- Mastra extracts automatic metrics after span output processors run. Enabling export alone saves durations and total tokens, but loses model/provider, costs and detailed usage under the current processor.
- The installed SDK supports provider-reported OpenRouter costs and pricing estimates. DuckDB supports raw metrics, aggregates, breakdowns, time series and percentiles.

Reuse those capabilities. Do not add an application metric accumulator, custom queue or replacement pricing implementation.

## Contracts

### Eligibility and metric coverage

`CATALOG_TRACING=true` plus an apply run without an injected candidate generator enables metrics. Logging remains independent. Attempts with tracing off or ineligible emit no metrics, including manually emitted SDK events reaching the application exporter. They do not open a store unless logging requires it.

Metric names are not enumerated by the application: newly emitted SDK metrics pass the same technical-name, numeric-value and safe-field validation without an application allowlist update. Current ingestion produces native agent/model/tool duration and token observations, with the SDK's technical status labels and cost context. The custom catalog root and initial-source spans are currently `GENERIC`; they do not automatically become workflow/tool duration metrics. Keep them as they are. Native generation duration also differs from the removed per-step log timer. Whole-ingestion duration stays in the durable report.

### Safe span and metric fields

Replace the flat tracing-only `tokenUsage()` shape with a small projection of the installed `UsageStats` type. Preserve finite nonnegative input/output totals and supported nested input/output details. Preserve safe provider, configured/response model, incomplete-usage flag and selected cost context. Cost metadata retains only `source=provider_reported` and a safe `pricing_id`; provider field names, pricing tiers, errors and other SDK accounting details are excluded.

Preserve normalized entity types and identities for the known research/editor agents and tools, using one mapping for their static names and types in span and metric projections. Model observations must retain their owning-agent relationship. Keep the existing trace display labels. Normalize metric entity grouping to stable technical names, including the catalog root, rather than using dynamic Event/Edition labels as grouping values.

Replace the metric no-op with a narrow eligibility and content boundary that delegates delivery to the native exporter. Validate metric names as bounded technical identifiers and require finite nonnegative values, without restricting names to a maintained list or category. The same rule applies to direct SDK emissions. Select safe labels, correlation and cost fields; retain real metric/trace/span IDs, timestamps and durable runId. Do not forward arbitrary metric metadata. Keep unique IDs in correlation columns rather than labels. A failed projection drops the metric with the existing content-free diagnostic mechanism.

This boundary also covers SDK metric contexts created before span processing or without a span. Such events must not bypass content exclusion or fabricate trace correlation. Use current SDK types instead of parallel storage schemas.

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
                              safe metric projection → storage exporter → DuckDB
```

CLI attempts retain owned-store cleanup. Studio attempts retain borrowed-store cleanup. Reuse the existing bounded flush before shutdown and failure isolation. Do not close Studio's store from an attempt or add a second observability instance for metrics.

### Remove duplicated observations

Remove `modelStarted` and its per-step `durationMs` from research logging. Remove the local start timestamps used only for `durationMs` in `read-page/tool.ts` and `search-web/tool.ts`. Retain start/outcome events, selected results, commentary/reasoning, step/attempt context and log timestamps. Keep budget deadlines, model-call counts, retry/iteration counters and run duration because they govern execution or required reporting. Logging-only users retain events but lose the explicit per-operation duration field.

`writeDisposition()` is already shared for a returned writer result. Extend that consolidation to the full write observation and committed count in an ingestion-level helper used by workflow logging and tracing. Use existing writer lifecycle evidence; do not introduce another state machine. No writer invocation means `not_attempted`; pending execution without a confirmed result means `unknown`; a confirmed rollback means `rolled_back`; a returned result means `committed` only for changed apply operations, otherwise `unchanged`. Count confirmed changed operations once, use zero for non-commits, and null for unknown disposition. Remove the tracing shortcut that marks writes unchanged during research validation, before a writer call.

Keep descriptive trace labels, the application logging bridge, selected diagnostics and the finalization owner. Metrics do not replace those functions. The installed Pino export path still omits child bindings, and unrestricted SDK logs remain excluded.

## Simpler options

Removing only the metric no-op is insufficient: the probe saved no model identity, cost or detailed tokens. Expanding the safe projection is necessary.

An independent metric switch would require separating span recording from span persistence. Sharing tracing eligibility avoids that extra lifecycle. Custom outcome, ingestion-duration and search-cost metrics are deferred; existing reports retain those facts.

Removing durable usage accounting would make required reports depend on optional telemetry and change partial-cost semantics. Keep the accumulator. Stable trace display names could remove label-formatting code, but would change the Event/Edition trace-list contract and are outside this change.

## Risks and validation

- Exercise real research/editor SDK execution with offline model fixtures. Verify safe fields after creation, updates and completion, rather than testing only fabricated span shapes.
- Seed forbidden content in span/metric metadata, labels and cost fields. Inspect persisted records after reopen. Verify errors remain content-free and eligibility also rejects direct metric emission on logging-only runs.
- Check reported costs, zero, missing step costs, missing pricing and cache/reasoning subsets. Query total-token costs once and retain independent report accounting on failure/cancellation.
- Compare grouped research/editor observations, run/trace correlation and native technical status with host retrieval/editor outcomes. Do not promote a technical success into catalog success.
- Check committed, rolled-back, unattempted, unknown, no-op and dry-run write observations. Include a reporting failure after a confirmed commit.
- Exercise owned and shared storage, flush failure, repeated Studio attempts and database reopen. Use the built-in Browser to verify saved Metrics in Studio; API-only success is insufficient to claim UI verification.
- Keep metric semantics, eligibility and safe-field policy in the ingestion guide; keep setup, query examples and the Studio filter workaround in the development guide. Update project structure with timing and metric ownership. Run focused regression suites plus the project's type, lint, dependency, documentation and OpenSpec checks. Synchronize the owning main spec only after implementation is complete.

References: [Metrics overview](https://mastra.ai/docs/observability/metrics/overview), [automatic metrics](https://mastra.ai/reference/observability/metrics/automatic-metrics), and [metric queries](https://mastra.ai/reference/observability/metrics/queries). Installed SDK code and types govern implementation when remote documentation differs.

# Proposal

## Why

Local ingestion already records traces in DuckDB, but its exporter discards metrics and its span processor removes the fields needed for cost and usage analysis. Enabling native metrics will make agent performance inspectable in Studio and let us remove repeated timing code.

## What Changes

- Persist SDK metrics for eligible traced apply runs without an application-maintained list of metric names. Current coverage includes automatic agent, model and tool metrics. Use the existing tracing switch, local store and Studio inspection flow.
- Preserve safe model, cost, token-detail and entity context through span sanitization. Keep metric records linked to the durable ingestion run and their trace.
- Expose reported model cost or an identified pricing estimate without treating either as the complete ingestion bill.
- **BREAKING**: Remove manually measured `durationMs` fields from model-step and tool-call application logs. Keep their selected events, context and results; native traces and metrics own operation timing.
- Consolidate write-disposition and committed-count projection for logs and traces, including unknown and unattempted writes.
- Retain required report accounting, execution budgets, the application-log bridge and existing descriptive trace labels.

Independent metric switches, custom ingestion/business metrics, search-cost metric emission, historical backfill, cloud export and a custom dashboard are outside this change.

## Capabilities

### Modified Capabilities

- `catalog/source-workflow`: Local execution metrics, safe correlation and cost semantics, operation timing ownership, and consistent write observations.

## Impact

The changes affect ingestion observability/tracing, model and tool logging, write observation helpers, adjacent tests and local inspection documentation. Existing pinned Mastra packages provide the required APIs. Metrics use the existing DuckDB observability domain; catalog schema and report v5 do not change. The implementation must validate persistence and aggregation after reopen, CLI/Studio ownership, content exclusions and unchanged ingestion outcomes.

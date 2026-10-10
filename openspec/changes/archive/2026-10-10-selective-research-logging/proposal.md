# Proposal

## Why

Local research needs useful, durable diagnostics in Mastra Studio. The first logging implementation achieved that but wrapped ordinary log calls in event registries, payload callbacks and types, recursive filtering, and whole-record size enforcement. Those layers obscure what each producer records.

## What Changes

- Use Mastra `PinoLogger` with conventional `debug`, `info`, `warn`, `error`, and `child({...})` calls. Producers pass plain objects containing only useful fields. Add `@mastra/loggers` as a direct dependency.
- Keep optional logging and tracing independently configurable. Reuse the durable ingestion runId, real trace/span IDs when available, local DuckDB persistence, Studio inspection, and bounded best-effort cleanup.
- Retain completed-step commentary and provider-returned textual reasoning as separate events. Shorten selected text explicitly with `shrinkText(text)` at a 4,000 Unicode-code-point default. Exclude prompts, message history, source Markdown, full responses, transport data, and raw exceptions.
- Remove the event-message registry, per-event payload types, payload callbacks, runtime field allowlists, recursive payload processing, and whole-log-record 8 KiB cap. Text and field selection belong to producers. No compatibility with the previous internal API or stored log payload shape is required.
- Bridge the installed Pino integration where necessary: `@mastra/loggers@1.3.5` forwards original call arguments separately from native Pino serialization. Ensure child context and canonical run/trace/span correlation reach persisted Studio logs without relying on serializers, mixins, bindings, or redaction for protection. Admit selected application logs in the exporter without forwarding every SDK log.
- Simplify host tracing to explicit input/output/metadata objects and ordinary TypeScript types. Keep the smallest needed exclusion of SDK-generated sensitive span payloads; inspect source-level SDK suppression where available. Remove logging's dependency on `trace.summary()` and calculate straightforward outcomes where emitted.
- Preserve research decisions, reports, durable run records, budgets, catalog writes, eval acceptance, and exit status if observability fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: readable, selected application logs and safe traces with durable local inspection and independent failure handling.

## Impact

This change owns the current logging and tracing simplification. `clarify-ingestion-traces` remains archived as the earlier trace change; its trace requirements affected by this migration are included in this change's delta.

Ingestion producers, the shared observability runtime, tracing, tests, and operational documentation. The catalog remains on SQLite/Drizzle; observability remains on DuckDB. Historical observability files remain untouched. Hosted telemetry, automatic SDK log forwarding, complete request/response recording, and public website behavior are outside scope.

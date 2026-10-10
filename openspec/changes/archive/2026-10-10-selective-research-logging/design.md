# Design

## Context

The archived implementation already has opt-in DuckDB logs, apply-only traces, Studio inspection, and durable ingestion run IDs. Its custom logging vocabulary and projection pipeline create excessive indirection. The installed `@mastra/loggers@1.3.5` sends original log call arguments to observability independently of native Pino serialization. The log exporter currently filters on `catalogSelectedEvent`. These implementation facts make a small, deliberate persistence bridge necessary.

## Goals / Non-Goals

**Goals:** A producer can read its own logging statement and see exactly what it records. Stored Studio logs contain the selected context, severity, runId and available trace/span IDs. Traces retain useful host facts while excluding automatic SDK content. Failures in either signal never change ingestion behavior.

**Non-Goals:** A generic logging framework, an audit log, wholesale SDK forwarding, source/prompt capture, retrospective conversion of stored records, or a change to research/catalog decisions.

## Decisions

### 1. Ordinary Pino calls and explicit field selection

Create a Mastra `PinoLogger` for enabled application logging and use `child({...})` for run, stage, source, model, and tool context where useful. Producers call standard level methods with a short message and a plain object. For example, a source producer records `sourceCharacters: markdown.length` and `response: { status: res.status, url: res.url }`, never the Markdown or full response. Error producers select safe codes/status/retryability, not exception objects. A small helper may shorten a known text field or remove repeated boilerplate, but no event-code registry, callback-valued payload, per-event payload type, recursive object sanitizer, runtime allowlist, or whole-record size processor returns.

`shrinkText(text, limit = 4000)` uses Unicode code points and returns the shortened string; a producer records original length and whether shortening occurred when useful. Apply it explicitly to selected completed-step commentary/reasoning. Keep ordinary assistant commentary distinct from provider-returned reasoning and retain their step/attempt origin. No streaming fragment collection, extra model calls, or change to generation settings.

### 2. Persist selected Pino arguments with correlation

Verify installed Pino behavior in the dependency source and a reopen test. Native Pino child bindings, serializers, mixins, and redact options do not automatically protect or populate observability records because the original per-call arguments are separately exported. The smallest bridge merges scoped child context with the selected per-call object before the observability path and injects the durable runId plus real trace/span correlation in the canonical stored fields. It preserves level and message. Use the narrow `catalogApplicationLog: true` application-origin marker in the exporter so SDK logs remain excluded; remove the old `catalogSelectedEvent` contract deliberately. The bridge must not become another payload-processing framework. Calls to disabled or failed logging are safe no-ops or fixed diagnostics.

When application logging is enabled, pass the shared native PinoLogger to Mastra with runId child context. Keep `loggerOptions.export: false`: SDK diagnostics go to stderr at the configured severity, while application records use the explicit Studio bridge exactly once. Leave Mastra logging disabled for tracing-only runs and the inspection-only Studio server.

### 3. Explicit host tracing and SDK exclusion

Construct root/source trace input, output, and metadata explicitly from known host values. Keep Event and edition labels, source retrieval status, validation and write disposition, runId, and technical status. Remove generic trace projections, chained callbacks, and logging use of `trace.summary()`. Compute simple outcome fields at their emission sites; share only a helper that eliminates meaningful duplication.

Inspect automatic SDK span capture separately. Suppress generated inputs/outputs at the SDK source where supported. If that cannot keep prompts, message history, source bodies, full responses, and raw errors out of exports, retain the smallest mandatory fail-closed exclusion for SDK-generated spans. Host-owned explicit fields should survive export and reopen. Trace-only runs must not require logging; log-only/dry/injected runs must not create spans. Do not assume a trace sanitizer also protects logs.

### 4. Storage and lifecycle

Keep `CATALOG_LOGGING`, `CATALOG_LOG_LEVEL`, `CATALOG_TRACING`, and `CATALOG_OBSERVABILITY_DATABASE_PATH` independent, with DuckDB as the Studio store and exclusive process ownership. Initialize optional observability after the durable start insert. Reuse that runId in reports, logs, and traces. Preserve apply-only trace gating, one root with its native child relationships, and stable Event/edition labels. End owned spans, flush both signals, and attempt shutdown within the bounded cleanup path even when an earlier phase fails. Logging/tracing errors yield fixed, content-free diagnostics and never replace the original ingestion result or required persistence error.

## Verification

Use offline mock-provider and temporary store tests for all enabled/disabled combinations, child context, canonical runId queries, severity and trace/span filtering after reopen, commentary/reasoning shortening, excluded content, SDK span exclusions, failures and cleanup. Run type checking, relevant tests, lint/format, docs and OpenSpec validation, OpenSpec verification, independent Sol review, and built-in Browser/Studio inspection when DuckDB is free.

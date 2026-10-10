# Tasks

## 1. Existing foundation

- [x] 1.1 Establish optional DuckDB observability storage, Studio inspection, independent logging/tracing switches and levels, durable runId correlation, and exclusive local ownership.
- [x] 1.2 Capture host source/model/tool/write events, completed-step commentary and returned reasoning, and apply-only traces with safe Event/edition labels.
- [x] 1.3 Preserve durable run records, report and research semantics, and best-effort flush/shutdown behavior.

## 2. Simplify application logging

- [x] 2.1 Add `@mastra/loggers` as a direct dependency and replace the custom event writer with Mastra PinoLogger standard debug/info/warn/error and `child({...})` calls. Remove event-message registry, per-event payload types, callbacks, runtime field allowlists, generic recursive processing, and whole-record 8 KiB enforcement.
- [x] 2.2 Migrate every producer to explicit plain-object selection. Keep useful source response status/URL and source character counts; exclude source Markdown, prompts/history, full responses, transport data, SDK objects and raw errors from arguments at all levels.
- [x] 2.3 Add explicit `shrinkText(text)` at a default 4,000 Unicode code points for selected commentary/reasoning, with readable shortening metadata. Keep channels and completed-step origin distinct without duplicate final output.
- [x] 2.4 Inspect installed `@mastra/loggers@1.3.5` delivery and bridge child context plus canonical runId and real trace/span IDs into stored logs. Update the exporter filter from `catalogSelectedEvent` to a narrow application-origin distinction; verify SDK logs stay excluded.

## 3. Simplify tracing and lifecycle

- [x] 3.1 Replace generic host trace projection framework and callback chains with explicit input/output/metadata objects and ordinary TypeScript types. Remove log producers' dependency on `trace.summary()`; calculate straightforward outcome fields at emission.
- [x] 3.2 Inspect SDK-generated spans. Suppress automatic sensitive payload capture at source where supported; otherwise keep only necessary fail-closed exclusion. Verify safe host fields and labels persist after reopen while prompts, source bodies and full responses do not.
- [x] 3.3 Verify logging-only, tracing-only, disabled observability, and combined modes; provider/error/abort/lock/failure cleanup; independent business results; and durable runId/status/accounting.

## 4. Acceptance and documentation

- [x] 4.1 Run type checking, relevant offline provider/source/workflow/observability tests, lint/format, `npm run docs:check`, and `npm run openspec:validate`. Prove persisted child context, severity, runId and trace/span correlation, text shortening and content exclusion.
- [x] 4.2 Inspect a fixture run through built-in Browser and Studio when DuckDB ownership permits, without disrupting an active ingestion or Studio process. Update operational docs and the synced main spec to describe the new contract.
- [x] 4.3 Run OpenSpec verification and independent GPT-6 Sol review; address concrete findings and rerun affected checks. Leave changes active and uncommitted.

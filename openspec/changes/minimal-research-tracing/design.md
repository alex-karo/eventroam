# Design

## Context

See [proposal.md](proposal.md) for motivation. After merging main at `3dccdb2`, `researchFestival` still creates one Mastra instance per real generation and shuts it down in `finally`. Step callbacks now accumulate provider usage across completed calls; tracing must preserve that behavior. Source tools have explicit input/output schemas. Initial source reads, candidate preparation, and catalog writes remain outside the agent. The separate eval workflow has no observability configuration.

## Goals / Non-Goals

**Goals:** Add optional local observation at the existing agent boundary and a small inspection entry point. Reuse automatic spans and existing cleanup; keep the catalog writer and Next.js outside the integration.

**Non-Goals:** No workflow conversion or shared Mastra lifecycle refactor. No host-stage spans, eval workflow/scorer instrumentation, new report fields, metrics backend, remote exporters, search token/cost enrichment, or configurable sampling. If evals explicitly enable tracing for their real research-agent calls, only those individual agent invocations are traced; no shared eval hierarchy is promised.

## Decisions

### Opt in through one environment switch

Use `CATALOG_TRACING=true`; unset or false disables tracing. This proposed default preserves current commands and fixture tests without creating runtime files. Create storage only on the real-agent path. Keep the normal configuration load and generation callbacks intact.

### Dedicated local LibSQL storage

Add compatible pinned `@mastra/observability` and `@mastra/libsql`, configure `Observability` with `MastraStorageExporter`, and sample all enabled invocations. Default storage is `data/mastra-traces.sqlite`, already covered by the ignored `data/` directory. `CATALOG_TRACE_DATABASE_PATH` permits an explicit path and is resolved to an absolute path before use. This store never uses `DATABASE_PATH` and has no catalog tables or migrations.

LibSQL is sufficient for span inspection. DuckDB and composite storage would add dependencies for aggregate metrics that this plan does not require. Verify dependency compatibility with the pinned Core and Node versions during implementation; the research checked observability `1.18.4` and LibSQL `1.25.1` peer ranges against Core `1.74.0`.

### One small tracing helper and a storage-only Studio entry point

Keep store/configuration and export sanitization in a small ingestion runtime helper. Attach tracing options to the existing agent generation: hide input/output and add `mode`, `eventId` when supplied, `model`, and `promptVersion`. Do not add business-outcome computation to spans: generation status is technical, and existing reports remain authoritative for research completion and writes.

Add a compatible pinned Mastra CLI development dependency and `npm run catalog:studio`. A small launcher resolves the shared store path from the project working directory and passes it as an absolute environment value before starting the CLI, avoiding differing CLI/Studio working directories. `src/mastra/index.ts` exports a Mastra instance with that storage and no registered agents or workflows; it needs no OpenRouter key or catalog connection. Bind Studio to localhost. Its role is to inspect existing traces; it does not start research.

### Exclude contents across all export fields

Use `hideInput` and `hideOutput` for the whole agent trace. Keep the existing silent structured-output logger and explicitly set `logging: { enabled: false }` in the observability configuration. `logger: false` alone does not disable forwarding: Core's `DualLogger` can send events through the observability logger context independently. Span processors do not sanitize those log events. Verify that sentinel SDK/agent logs are absent from the store as well as from exported JSON.

Add one narrow sanitization processor for residual attributes and errors, retaining only operation/model identifiers, numeric usage, technical status, and bounded application metadata. Strip raw messages, stacks, provider payloads, and content-bearing attributes such as agent instructions/prompt and model parameter headers. Mutate and return the same live span, as required by `SpanOutputProcessor`; do not return a copied object. Catch errors inside the processor, emit a fixed sanitization diagnostic, and return `undefined` to drop the span. Merely throwing is unsafe because the SDK can catch the processor error and continue exporting the unsanitized span. Verify persisted spans and JSON exports with sentinel content, including an injected processor failure. Final model output remains available only through the existing private report contract.

### Preserve cleanup without making observability a research gate

Retain the existing per-invocation `finally` boundary, but explicitly call `await mastra.observability.flush()` before `await mastra.shutdown()`. Core 1.74.0 closes storage before shutting down observability, while the storage exporter buffers events; relying only on shutdown can lose spans from a short invocation. Handle errors from flush and shutdown independently so shutdown still runs after a failed flush and neither failure replaces the original generation result or provider/budget error. Verify a real buffered-exporter invocation that exits before its automatic batch flush, then reopen the store in another process to inspect completed and terminal spans. Persistence is best effort: an already-running background flush can race with another flush or storage closure, and forced termination, including SIGKILL, can also leave incomplete traces. Keep the current SDK batching; custom buffers, write queues, and an exporter dependency patch are deferred.

Application tracing diagnostics use fixed codes in stderr, such as `trace_initialization_failed`, `trace_export_failed`, `trace_flush_failed`, `trace_shutdown_failed`, and `trace_sanitization_failed`, with no original messages, stacks, or payloads. Observe asynchronous initialization and internally handled persistence failures through a narrow tracing-component logger adapter and exporter drop notifications (`onDroppedEvent`), not only an outer `try/catch`. The adapter discards SDK text and metadata instead of forwarding them, and observability log forwarding remains disabled. LibSQL's private DB logger may additionally print original technical errors and stacks to local stderr; suppressing that output is outside the minimal scope. This exception does not relax sanitization of persisted spans, exports, stored logs, or research reports. Ensure store initialization has completed before attaching tracing to generation; failure falls back to the same agent execution without tracing. Test an initialization failure separately from a write failure after successful initialization, including an exporter failure swallowed internally. No new report field, general application logger, or automatic research retry is added.

## Risks / Trade-offs

Generation completion time is captured before tracing cleanup. Provider failures and empty results are classified against that time and the original research deadline, so flush/shutdown latency cannot turn an earlier provider failure into a research timeout. Actual generation aborts and explicit budget errors retain their limit classification.

- Accepted deferred risk (2026-10-09): Observability 1.18.4 does not await an already-running timer flush from explicit `flush()`. A slow background span creation can overlap a later terminal update or storage shutdown. With `maxRetries: 0`, terminal updates can be dropped before creation finishes, or the pending write can fail after storage closes; traces may be incomplete or absent. Review reproduced this with a deliberately held DB write. The default timer is 5 seconds and the batch threshold is 1,000 buffered events, but triggering a background flush alone does not imply loss: it must overlap another flush or cleanup. Ordinary local write latency suggests a narrow collision window; no production frequency or percentage has been measured. The six standard-tier eval cases took about 9–30 seconds end to end and passed research assertions, which does not establish trace completeness or isolate agent timing. The owner accepts best-effort local tracing for now. Revisit serialization and tracking of in-flight flushes if missing/unfinished traces or `CLIENT_CLOSED` export failures recur, or before making tracing an audit/completeness requirement. Research results, catalog writes, and report/exit behavior remain independent.
- Upstream tracking for the background-flush risk: [Mastra issue #26501 — Several exporters' flush() / shutdown() return before their data is actually sent](https://github.com/mastra-ai/mastra/issues/26501) is open as of 2026-10-09 and includes `MastraStorageExporter`. It replaces [issue #26482](https://github.com/mastra-ai/mastra/issues/26482), which was closed to consolidate tracking, not because a fix was released. Reassess the deferred workaround after an upstream fix is released and verified against our shutdown regression scenario.
- Accepted local stderr exception (2026-10-09): LibSQL 1.25.1 captures a private DB logger before `__setLogger` can reach it. A real write failure can therefore print the original SDK error and stack despite the safe adapter. The owner relaxed local stderr requirements; a logger dependency patch is deferred. Persisted traces, exports, and reports retain their content exclusions.
- Hidden contents limit factual debugging: use existing private final-output and source reports alongside operation timing.
- SDK attributes, error fields, and forwarded logs can contain content: disable log forwarding, drop spans on sanitization failure, and test the persisted representation.
- Exporter errors can be handled internally: observe the tracing-component diagnostic channel and drop notifications, and test failures beyond an outer catch boundary.
- Local files grow with every enabled invocation: document the store path and deletion while processes are stopped; automated retention is deferred.
- Studio reads a different file if relative paths diverge: use the launcher's absolute shared path and test a completed CLI trace in Studio.

## Migration Plan

Install the pinned dependencies, add the optional configuration and local command, and document activation and inspection. No catalog or report migration is needed. To disable, unset `CATALOG_TRACING`; retain or delete the separate trace store after stopping research and Studio. Sync the added requirements to the owning main spec only after implementation is complete.

## References

- [Mastra tracing usage](https://mastra.ai/docs/observability/tracing/overview)
- [Mastra storage exporter](https://mastra.ai/docs/observability/integrations/exporters/mastra-storage)
- [Observability configuration and log forwarding](https://mastra.ai/reference/observability/tracing/configuration)
- [Studio observability](https://mastra.ai/docs/studio/observability)
- [Absolute shared storage paths](https://mastra.ai/integrations/frameworks/next-js)

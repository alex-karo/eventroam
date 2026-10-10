# Tasks

## 1. Existing trace behavior

- [x] 1.1 Provide one apply-run root with stable Event/edition labels, native agent/tool child spans, safe source diagnostics and separate research/validation/write outcomes.
- [x] 1.2 Preserve apply-only gating, durable runId metadata, local persistence, independent best-effort failures and Studio inspection.

## 2. Simplification

- [x] 2.1 Replace generic host trace projections, recursive allowlists, byte/list whole-projection enforcement and callback chains with explicit input/output/metadata objects and ordinary types. Keep useful labels, source metadata, validation/write disposition and known committed count.
- [x] 2.2 Inspect installed SDK span capture. Suppress automatic sensitive content at source where supported, or retain the smallest necessary fail-closed exclusion; verify prompts, history, source bodies, full responses and raw errors do not persist.
- [x] 2.3 Remove logging's dependency on `trace.summary()` and preserve real runId/trace/span correlation without inventing missing IDs. Verify tracing-only, logging-only, disabled and combined modes and failure-safe cleanup.

## 3. Verification and documentation

- [x] 3.1 Run relevant offline trace/source/workflow tests, persistence reopen checks, type checking, lint/format, `npm run docs:check` and `npm run openspec:validate`.
- [x] 3.2 Reconcile synced main spec and operations docs; run OpenSpec verification and inspect Studio in built-in Browser when DuckDB ownership permits. Current follow-up simplification is owned by `selective-research-logging`; retain this change in its original archive location.

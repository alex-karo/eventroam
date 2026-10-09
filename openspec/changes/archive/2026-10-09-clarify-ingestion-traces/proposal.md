# Proposal

## Why

Current traces hide Event/source context and end before validation and catalog writes. Owners need to distinguish technical completion, research completeness, and the actual catalog result.

## What Changes

1. Readable Event/edition, mode and result labels in both `name` and `entityName`, with stable primitive IDs and separate edition keys/years for context and committed changes.
2. Bounded source diagnostics: read URLs, outcome/reason/method/truncation, and existing search queries/candidate URLs. Preserve source URLs up to the length limit. Disable SDK input/output hiding; retain mandatory field allowlisting and exclude SDK/config credentials and full payloads without changing model behavior.
3. One outer per-Event span from context loading through initial read, research, validation, write/rollback and report construction. Reuse report research/outcome values alongside validation, write disposition and one committed-operation count; keep native technical status and `semanticValidation: not_run`. Preserve the existing report contract.

**BREAKING:** Dry-run creates no traces even when tracing is enabled; its existing reports and durable run records remain available.

Out of scope: report-to-trace correlation, retry instrumentation, full debug payloads, factual validation, changed decisions/budgets/retries, Studio replacement, storage migration, metrics backend and paid ingestion. Preserve opt-in, fail-open tracing and accepted persistence/logger limits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: readable local traces, safe source diagnostics, complete apply-run outcomes.

## Impact

Changes affect ingestion orchestration, tracing, source hooks, tests and operational docs. Existing dependencies and separate trace storage remain; no database migration. Report schema and readers remain unchanged. Acceptance uses mocked providers and temporary stores. Sync main specs only after implementation.

# Proposal

## Why

Owners need local apply-run traces that identify the Event, source results, validation and catalog write outcome. The first implementation achieved this through generic projection and sanitization layers that are larger than the host facts being recorded. The logging migration also removes any need to calculate log outcomes from a shared trace summary.

## What Changes

- Keep readable Event/edition labels, stable IDs, one apply-run root, source retrieval metadata, and separate research/validation/write outcomes.
- Build host trace input/output/metadata explicitly from known values with ordinary TypeScript types, reducing intermediate projections and callbacks.
- Inspect SDK automatic span payloads separately. Suppress sensitive automatic capture at its source where supported, or retain the smallest fail-closed exclusion needed to keep prompts, message history, source bodies, full responses and raw errors out of exported spans.
- Preserve optional tracing, apply-only gating, runId correlation, local persistence and best-effort flush/shutdown, independently of logging. Dry runs create no spans.
- Drop the generic whole-projection byte/list enforcement and field allowlists for host-owned values. Producers select and shorten relevant fields. There is no requirement to preserve the prior internal trace payload shape.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: readable, safe local traces with explicit host fields and complete apply-run outcomes.

## Impact

Tracing runtime, source hooks, observability tests, and operational docs. Existing historical observability files, report schema, durable run records, and catalog decisions remain unchanged.

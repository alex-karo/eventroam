# Proposal

## Why

Local research reports preserve final model results and usage, but do not show the sequence or duration of individual model and tool calls. Add a small local tracing setup to diagnose agent execution without introducing a hosted service or changing catalog decisions.

## What Changes

- Opt in to tracing the existing festival research agent, including automatic model and tool spans, with all enabled invocations sampled.
- Persist traces in a dedicated local Mastra store and inspect them through a local Mastra Studio command.
- Attach only mode, requested Event ID when available, model, and prompt version as application metadata.
- Hide span inputs and outputs, sanitize residual fields, and explicitly disable observability log forwarding; drop spans whose sanitization fails.
- Attempt to flush pending traces before closing storage on normal completion, handled errors, and cooperative cancellation, with independent error handling for flush and shutdown. Accept best-effort persistence and defer the known SDK background-flush race.
- Surface tracing initialization and persistence failures through fixed application diagnostic codes in stderr, including failures handled internally by the exporter, without changing research results. Accept additional original technical errors/stacks from LibSQL's private local logger.
- Defer host-stage spans, eval workflow/scorer tracing, report trace IDs, aggregate metrics, custom search cost spans, remote exporters, and sampling controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Optional local tracing and inspection of research-agent execution, with private bounded exports and independent catalog/report behavior.

## Impact

- Research agent initialization and its generation options; a small ingestion tracing helper; environment configuration and local scripts.
- A storage-only Studio entry point sharing the trace database with catalog commands.
- Add compatible pinned `@mastra/observability` and `@mastra/libsql` runtime dependencies and a compatible Mastra CLI development dependency.
- Local data under ignored `data/`, separate from the catalog database; no catalog migration or report schema change.
- Development and ingestion documentation, plus the owning OpenSpec specification after implementation.

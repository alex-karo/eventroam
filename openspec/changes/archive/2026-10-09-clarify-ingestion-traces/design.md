# Design

## Context

The existing apply-run tree, Event/edition labels and outcome fields work. Generic trace projections, per-span host projection state, recursive allowlisting, and cross-layer callbacks make those facts difficult to follow. Optional logging now uses Pino and should calculate its own straightforward status fields at the emission site.

## Goals / Non-Goals

**Goals:** Keep clear trace labels and outcome dimensions with a small explicit host trace implementation. Prevent automatic SDK spans from exporting sensitive content. Preserve independent tracing, durable runId and failure-safe lifecycle.

**Non-Goals:** New trace stages, prompt/source capture, a new report or catalog schema, semantic fact verification, or a shared logging/tracing payload framework.

## Decisions

### 1. Host identity and explicit fields

Retain stable primitive span IDs and readable root/source labels with canonical Event identity, separate context/committed edition roles, effective years where known, mode, and terminal research/write result. Construct root/source input, output and metadata directly from host-known values, including source URL, status, method, completeness, source length when relevant, validation states, write disposition and confirmed changed count. Use ordinary TypeScript types and a small label helper only when it eliminates duplication. Do not derive unknown years, successful retrieval from technical completion, or committed writes from a dry-run preview.

Use real runId metadata and parent/child relationships. Keep one outer apply-run root before context/initial retrieval, nested agent/tool spans, and completion after report construction or failure. Existing reports supply research status/outcome when available; no report means omit unknown values. Native span status remains distinct from research and writer outcome.

### 2. SDK content boundary

Inspect installed Mastra span creation for options that suppress automatic inputs and outputs before export. If effective for agent/model/tool generated content, use them. Otherwise retain a minimal mandatory fail-closed processor or exporter exclusion for SDK-generated input/output and raw errors while allowing explicit host-owned root/source fields. The boundary must cover creation and update/export lifecycle events, including unknown span types. No general recursive projection, field allowlist, total-record cap, or blanket reliance on Pino redaction is required for host objects. Source URLs keep their components as supplied when selected. Never pass source Markdown, prompts, message history, full responses, transport payloads or raw exceptions into host trace objects.

### 3. Independent lifecycle

Enable tracing for configured, non-dry-run real-agent apply work. Logging may be independently on or off. Initialize after the durable ingestion start insert; use the same runId in metadata. End owned spans, attempt bounded flush and shutdown even after an earlier cleanup failure, and preserve the original research/persistence result. A failed or locked observability store means tracing is unavailable for that run; it does not interrupt ingestion or take over another owner's DuckDB process.

## Verification

Use temporary offline stores and provider stubs to prove Event/edition labels, source outcomes, root result dimensions and runId survive reopen; automatic SDK payloads stay excluded; tracing-only/logging-only/disabled paths and cleanup failures preserve business results. Inspect a fixture in Studio with built-in Browser if the store is free. Run relevant tests, type checking, lint/format, docs and OpenSpec checks.

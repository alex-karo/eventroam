# Design

## Context

Tracing currently belongs to `researchFestival`; context loading/initial retrieval precede it, and preparation/writing/reporting follow it. The sanitizer removes display names and input/output. Source tools can return failed retrievals without throwing.

Current Mastra supports generic spans and `tracingContext.currentSpan`. Studio prefers `entityName || name`; current LibSQL lacks advanced metadata/tag queries and metrics-backed token/cost list columns. The design must work through visible labels and span details.

## Goals / Non-Goals

**Goals:** Implement the three improvements in [proposal.md](proposal.md), using the contracts in the [delta spec](specs/catalog/source-workflow/spec.md).

**Non-Goals:** No workflow conversion, detailed HTTP-stage tree, new catalog run storage or changed research behavior. CLI preflight and later batch report delivery remain outside the per-Event span.

## Decisions

### 1. Host-owned identity and edition roles

Keep primitive IDs `catalog-research` (root), `festival-research` (agent), `readSource` and `discoverSources`. Keep existing Event/run metadata separate from display labels; add no correlation IDs. Initially label with the sanitized requested name or Event ID; after context loading use the canonical saved name, or a validated new identity for add. Exclude unrelated matching-context Events and never replace a canonical name with a model mismatch.

Maintain bounded `{ occurrenceId?, editionKey, year: number | null }` lists for context and committed mutations:

- Context snapshots saved `occurrenceYear` before research.
- Mutations resolve IDs and effective years from the returned CatalogItemResult merged with context. Failed writes create no committed entries; no writer callbacks or transaction hooks are needed.

Never infer years from keys, dates or the calendar. Render matching key/year as `2026`, otherwise `2026 [key:summer]`; a null year is `? [key:2026]`. Keep `ctx` and mutation roles distinct; uncommitted discoveries remain in reports. Example: `Festival · ctx:2026 · check · partial · created:2023`. Omit the redundant apply label. Invalid/write-failed/report-failed outcomes take precedence over reassuring labels. Reserve mode/result suffixes before shortening names/lists; use `+N` overflow and bounded details.

Use the supported `insert-only` storage strategy: this SDK's update records omit `entityName`, so completed-span insertion is necessary to persist both final display fields without an exporter patch. In-progress and forcibly interrupted spans may be absent.

A span-ID-keyed host state supplies safe `name` and `entityName` on every export, including terminal updates. Update the name through the span API and derive entityName in the processor; apply this to source labels too. Metadata-only or rootSpanName-only solutions cannot satisfy current Studio visibility.

### 2. Sanitizer owns content exclusion

Set `hideInput: false` and `hideOutput: false`, including nested calls: SDK export applies hiding after processors and would otherwise discard safe projections. Before every export, clear original input/output for every span, then reconstruct only the allowlisted root/source projection from host state. Agent/model/unknown span payloads remain absent. Disable SDK log forwarding. Drop a span on sanitization failure; if the processor cannot be installed, disable tracing and continue research. No exporter-side restoration or raw fallback.

Build diagnostics from typed host inputs/results before model-facing projection loses method. Use the existing current tool span, plus one source child for the initial read; do not duplicate automatic tool spans. Keep tool arguments (`url`/`query`), schemas, descriptions, prompts and model messages unchanged. Retrieval reason is an existing technical code, not an added model explanation.

Use short safe labels such as `readSource · example.org/en/ · failed:request_failed` and `discoverSources · 3 URLs`. Read projections retain attempted/final URLs, outcome, allowlisted reason or unknown, method (`http`, `firecrawl`, `social_stub`, unknown), completeness and separate source/tool truncation. Capture extractor truncation before reason replacement if needed; tool truncation observes existing Markdown shortening. Unobserved truncation remains unknown; initial reads have toolTruncated=false. Cached results do not imply network calls. Discovery records the existing query, candidate URLs/counts and observed execution status; budget-reserved searches are not_run, not successful empty searches. Thrown failures retain only safe arguments/codes.

Apply the delta's UTF-8 byte, list and serialized-size bounds before labels and at export, using one Unicode-safe byte truncation helper without separate character limits. Construct fresh allowlisted objects; exclude pages, prompts, messages, raw tool/model results, titles/snippets, factual explanations, request context/tags, transport data and raw errors. Other spans retain the existing bounded numeric/technical allowlist. Final model output stays in private reports.

Preserve source URLs as supplied, including path, query and fragment, with only the 512-byte character-safe length limit; mark truncation. Do not strip URL components, decode/rewrite paths, scan for token patterns or compare URLs with configured secrets. The same rule applies to URLs in queries and labels, within their field limits. Existing source-input validation remains unchanged. The sanitizer is a field allowlist, not a general secret detector for public source text: SDK/config credentials, authorization headers and transport payloads are never selected. Keep display text single-line and trim optional text/list entries to total limits while preserving status/counts and truncation markers. These limits do not alter requests, budgets or model results.

### 3. Run lifecycle and terminal projection

Move tracing ownership to `runCatalogResearch`. Enable it only for non-dry-run invocations with tracing configured and no injected generateCandidate; otherwise skip all tracing initialization, including nested agent tracing. Use one instance/store and generic root before context loading, through initial read, generation, preparation, atomic writing and report construction. Nest the agent with `tracingContext: { currentSpan: runSpan }`; parentSpanId is external correlation, not live nesting. Keep native children and use root phase metadata instead of additional host-stage spans.

The owner uses try/catch/finally: record the final projection, settle/end owned children and root, await flush, then attempt shutdown even after flush failure. Remove agent-level early store shutdown. Unexpected context/source/report errors retain original behavior and fixed stage codes, never fabricated reports or rollback. Preserve the existing budget, retries, model-finish timestamps and timeout classification; cleanup cannot turn earlier completion into a timeout or replace a result/error.

Copy researchStatus and outcome from the existing report when available; omit them if report construction fails without a fallback report. Use the native span status for technical completion, errors and aborts. Keep structuralValidation, targetValidation, semanticValidation=not_run, writeState, a fixed errorCode when applicable, and committedOperationCount from confirmed changed receipts. Do not add parallel status calculation, reportState, writeReason or intermediate operation counts. A valid failed envelope can pass structural validation with targetValidation=not_run. Caught provider/writer exceptions remain technical errors; domain partial/invalid outcomes need no artificial SDK exception. Writer constraints belong to write outcome, not factual validation.

A report-construction error after a confirmed commit retains committed state/count. Unestablished transaction disposition remains unknown with a null committed count.

Reports, readers and durable run records keep their existing contract, including runId. Add no tracing reference or lookup mechanism; do not duplicate report diffs or unbounded operations in spans. Multi-target checks retain one trace per eligible Event, without a batch root.

## Risks / Trade-offs

- Disabled SDK hiding makes sanitization mandatory → test saved/exported spans, every lifecycle event, unknown fields and failure paths; never export without the processor.
- Length bounds reduce detail → retain URL components within the limit, explicit truncation/omission counts and role-specific years/keys.
- Dry-run has no span-level diagnostics → use its existing report and run record; tracing is reserved for apply runs.
- Background flush races/forced termination may lose spans; LibSQL's private logger may emit technical errors/stacks locally → retain accepted best-effort/local-stderr limits, explicit cleanup and strict storage/log exclusions. No exporter patch or queue.
- Structural success can still contain mistaken facts → expose semanticValidation=not_run without changing research decisions.

## Migration Plan

Use current pinned packages and tracing switch; no schema migration or historical trace/report rewrite. Disabled, dry-run and injected generateCandidate paths create no trace store/records. Keep existing reports and durable run persistence unchanged.

Extend the existing offline mock-provider fixture through the workflow using apply runs against temporary migrated catalogs and separate trace stores; block live network/provider calls. Test pure terminal projections directly without adding a tracing injection API. Use separate public URL/name markers and private payload/credential sentinels. Cover the delta's outcome matrix, incomplete usage/null cost, sanitizer sentinels, fresh-process export and tracing-on/off business parity. Use built-in @Browser on a separate fixture Studio port: verify visible Event/year roles/mode/result, source failure reason and terminal write outcome. Leave the running Studio at port 4111 and existing stores untouched. Update operational docs and sync main specs after implementation acceptance.

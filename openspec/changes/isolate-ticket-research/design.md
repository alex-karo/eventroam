# Design

## Context

See [proposal.md](proposal.md) for motivation, the [delta spec](specs/catalog/source-workflow/spec.md) for behavior, and [tasks.md](tasks.md) for detailed verification. This document describes the planned architecture.

`workflow.ts` already owns the source session, budget, research, preparation, atomic writer and reporting. `research/agent.ts` owns Mastra execution and provider adaptation; `prepare.ts` and `money.ts` validate and convert accepted facts. `SourceSession` caches original extracted Markdown, while main-model tool excerpts are capped at 80,000 characters. Saved ticket variants contain navigation URLs absent from `knownLinks`.

Main at `6b3978d` uses the Mastra model router, bounded OpenRouter capacity retries, durable run records and optional per-Event apply-run tracing. The run trace owns final cleanup and safe source/write diagnostics. Existing version-2 reports and six captured eval cases can be extended without a new runner or storage migration.

## Goals / Non-Goals

**Goals:** move ticket interpretation out of the main prompt, preserve exact edition/source context, attach specialist results deterministically, and isolate ticket uncertainty from main completion.

**Non-goals:** generic delegation, independent specialist retrieval, Mastra Workflow conversion, new trace roots, new persistence guarantees or increased limits. Scope remains in the proposal.

## Decisions

### 1. Keep the existing host sequence

```text
Context + initial read → Main → Preflight → Optional ticket batch
    → Assemble → prepareResearch → Atomic writer → Cleanup → Report
```

Use ordinary TypeScript `runCatalogResearch` and two Mastra Agents. Mastra recommends Workflows for predefined multi-step processes; this change retains the existing sequence to avoid migrating budget, abort and write behavior into a second execution engine. A nested specialist tool would put ticket JSON back into the main conversation; per-edition calls would repeat shared pages and consume more reservations. Main never reads or reinterprets specialist output.

Extract pure target, creation-reason and duplicate-add checks from `prepare.ts` for preflight, without generating disposable operations. Validate main structure, edition keys and routed session membership before specialization. Failed/invalid main output produces no operations. Duplicate add skips specialization and writing while preserving the existing metadata/status behavior. No editions or no inspect requests also skips the specialist.

### 2. Use small internal contracts

Keep the existing final `researchCandidateSchema`. Main forbids edition tickets and instead requires private routing:

```text
ticketResearch: { state: "inspect" | "not_found" | "unfinished", sourceUrls, reason }
```

`inspect` selects already-read relevant pages; `not_found` records a reasonably completed check without published details; `unfinished` records a blocked, conflicting or unreached check and becomes a scoped question. Routing alone does not certify completion. Main status concerns identity, relevant edition/dates and location, independently of tickets. Enforce that policy through instructions, schema descriptions and evals; host validation remains structural.

The specialist returns only:

```text
{ editions: [{
  key,
  tickets?: { value: { variants, basePrice }, reason },
  unresolved: question[]
}] }
```

Reuse ticket/money/question schemas. Require exactly one entry per requested key; never bind by order. No per-edition status, model-generated errors or summaries: these would duplicate block acceptance and questions. Omission preserves prices; omission with no questions means inspection found no supported replacement. An unfinished check needs a question and cause. A complete block may accompany questions and remains usable. Host scopes questions to the edition/tickets and reports execution, limit and validation errors itself, without deriving per-edition statuses.

Apply schema-specific wire-null normalization/provider shape conversion: outer optional null means omission, inner `basePrice:null` remains meaningful. Extra fields, incompatible keys, incomplete blocks and invalid money reject the entire batch. No corrective model calls.

### 3. Preserve navigation leads and original evidence

For refresh/check, project saved variant URLs into private per-edition `ticketSourceUrls` before stripping saved price payloads from main context. Normalize/deduplicate HTTP(S) URLs within editions, retaining shared-URL ownership and requested-Event isolation. Leads carry no money, conditions or availability; main verifies identity/year before routing. They do not change `knownLinks`, initial-source selection or public links, and trigger no automatic reads. Existing source safety and limits apply, with default depth 1 for variant-only leads unless already known elsewhere.

Freeze each inspect packet using exact Event/edition identity, aliases, saved Occurrence ID, year/dates/location overlaid with proposed facts and explicit clears, selected ticket URL, routing reason, today and remaining budget. Reconstruct only that edition's saved block in major units; new editions receive an empty unknown block. Preserve actual legacy coverage in saved context, while new bases must cover the full programme.

Pass deduplicated routed session reads in chronological order with original full `read.markdown`, attempted/final URLs, retrieval time, outcome, completeness and reasons. Preserve alias/shared-page associations. Do not paraphrase, translate, filter or refetch; the specialist receives more source text than main's bounded excerpts when available. Brand/year conflicts become questions, never target reassignment. Partial or unavailable content cannot justify clearing from absence alone. Both agents treat source text as untrusted data.

Preflight the full input including instructions/schema/system overhead. If it cannot fit, skip generation, preserve prices and report a scoped input-limit question. Do not truncate, split or drop pages to force a call.

### 4. Share execution limits and own cleanup once

Keep one budget/deadline and existing defaults: 10 calls, 120,000 input characters and 16,000 output tokens per call, 20 pages, 3 searches, depth 2 and five minutes. Reserve one specialist call when at least two are available. Main's ordinary allowance excludes it; main tools/discovery stop when only main-final and specialist reservations remain. Release the reservation when preflight skips specialization. One available call is main-only; zero permits no generation.

Preserve main's existing provider_unavailable retry/refund exception, backoff, completed tools and retry step headroom; guarded budgets and `prepareStep` enforce the reservation. Discovery retains its bounded charged retries. Reuse the Mastra router/provider settings for the specialist, but use one attempt: `maxSteps:1`, `modelSettings.maxRetries:0`, `errorProcessorDefaults:false`, no retry processors, `maxProcessorRetries:0`, no tools/online routing. Every started specialist attempt consumes one call without refund, including capacity rejection; oversized input consumes none. Cached handoff consumes no retrieval capacity. Injected generators obey the same limits.

A small function-based helper owned by `runCatalogResearch` reuses the run trace’s Mastra instance when tracing is enabled and otherwise lazily creates one untraced instance. Its scope is the two concrete research agents and resource cleanup; Mastra itself supplies the component registry. Keep execution, budget accounting and reporting in their existing owners, without a generic manager, custom registry or lifecycle hooks. Neither stage shuts it down. All-injected runs create no trace store; injected/skipped stages create no agent spans. The orchestrator's outer `finally` attempts one flush then shutdown after both stages, deterministic preparation/write and report construction, before returning the finalized durable report. Cleanup diagnostics never replace research/write outcomes. Capture generation finish times before cleanup for original-deadline classification; total wall time includes cleanup. Deadline expiry stops model/network work but permits deterministic assembly and the short writer path.

Reuse the existing per-Event apply-run root and attach both agent subtrees beneath it; preserve initial-read and final-result/source diagnostics from main. Parameterize the sanitizer with allowlisted festival/ticket identities and host-owned per-invocation prompt/model/mode/Event metadata inherited by descendants. Late main events retain main labels. Preserve existing content exclusions, disabled SDK log forwarding, separate trace storage, storage-only Studio and best-effort persistence; no mutable current-stage label.

### 5. Assemble once and report execution separately

Strip routing and attach validated whole ticket blocks by exact key. Keep `prepareTickets`, deterministic conversion and one atomic writer; do not merge variants, reselect bases or infer clearing/availability. Ticket semantics remain in the delta spec. Invalid main/final candidates produce no operations; rejected specialist output omits all batch replacements while usable main findings remain applicable. Writer failure commits nothing and retains research status.

Retain valid main success/partial through accepted blocks, omissions, ticket questions, routing uncertainty and technical specialist failures. Main alone owns page summaries under existing validation; pass them unchanged through ticket rejection, no-op and write failure. Saved facts/echoed identity do not replace usable source findings; duplicate add keeps its existing shortcut.

Deduplicate diagnostics and retain one question per unfinished edition (at most 20). If merging exceeds the final 30-entry limits, reject the batch and use compact per-edition questions with original main diagnostics; if still invalid, write nothing. Never silently slice unrelated main diagnostics.

Keep version 2, main raw `modelResponse` and existing totals. Add `assembledCandidate` (normalized or null) and optional `ticketResearch:{outcome,raw,usage}`. Host outcome is skipped/completed/failed/limited; completed means a valid batch, even with omissions/questions. Raw responses survive validation/write failure; prompts, page bodies and transport details are not exported. Existing CLI presentation and old version-2 readability remain; ticket-only failure does not cause nonzero exit.

Sum main, specialist and discovery usage once. Skipped stages have zero complete usage; missing/interrupted usage retains known tokens but marks accounting incomplete and full cost null. Cached/reasoning counts remain subsets; traces do not determine accounting. Record both prompt identities in eval configuration.

### 6. Extend existing verification

Use injected offline tests for contracts, handoff, budgets, traces, assembly, preservation and atomic writes; tasks enumerate the cases. Extend the existing six-case runner only for saved-price seeding and assembled/effective-state scoring where diffs miss preservation/no-ops.

Later authorized model comparisons use separately saved reports from identified pre-change/updated revisions with common fixtures, state, date, model/effort and limits. Compare semantics, total tokens/cost and wall time, separating completion-policy differences from model quality. Unknown cost stays unknown. No embedded baseline, paired runner, prescribed campaign or paid default tests.

## Risks / Trade-offs

- Extra call/repeated context → deduplicate shared pages and measure total cost/latency later.
- Missing or misassigned evidence → exact edition packets and preserved navigation leads; the tool-free specialist cannot recover missing pages.
- Batch rejection/reservation reduces useful ticket work → preserve saved prices and expose scoped questions.
- Structurally valid interpretation can be wrong → retain the existing host acceptance policy and verify semantics through evals.
- Tracing may add latency or lose terminal spans → defer cleanup and preserve generation timing without stronger persistence promises.

## Migration Plan

Verify offline, update local consumers/docs, then sync the owning spec after implementation. No database migration or catalog rewrite. Rollback restores orchestration/prompts from the recorded pre-change revision; applied facts require ordinary versioned corrections. Accuracy, cost and latency remain unmeasured pending separately authorized model checks.

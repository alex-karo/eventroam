# Design

## Context

**Depends on:** [rename-occurrence-to-edition](../archive/2026-10-11-rename-occurrence-to-edition/proposal.md), implemented and synchronized in the worktree on baseline main `00eb481`. This design uses the Edition code/storage. The shared workflow, agent proposal shape, private report v2 and DB report check otherwise remain the current baseline.

## Goals / Non-Goals

Preserve the existing agent output, identity, validation, publication, discovery and URLs. Refresh remains one shared workflow and one atomic Event attempt. The prerequisite owns the Edition rename and catalog storage migration; this change owns refresh behavior and private report compatibility.

## Contract changes

| Surface | Exact change |
| --- | --- |
| Agent output / provider wire | **No naming or shape change:** `{status,data,errors,unresolved}`; `data.editions[]` descriptors use `key` and optional typed `year`; errors/questions use optional `editionKey`. Facts keep `{value,reason}`, existing tickets/classification/link slots, strict validation and wire-null normalization. No identity or finding-status output. |
| CLI / Studio / stored input | `add|refresh`; remove `check` without alias. Refresh takes repeated distinct Event IDs and `scope: "full"|"current"`, default full. Reject unknown scope and add+scope before allocating resources/history. Studio remains single-Event preview by default. |
| Refresh context / tools / state | Add assignment, supported-field registry, all-saved-country baseline, and latest resolution: `selected|none-found|unresolved`. Pure resolver + thin `resolveRefreshScope` tool adapter; injected generators use the same recording callback. See [exact contract](#resolver-contract). State remains serializable and owned by the existing workflow. |
| Private reports / consumers | v2 → v3. Refresh adds scope, assignment, selection, returned-fact verification, effective limits/workload. Use Edition metadata; preserve raw model response, run IDs, application outcomes, known costs/completeness, searchCostBasis, and scalar projections. Upgrade active readers/evals/fixtures together; reject v2 explicitly. |
| Errors / observability | Add host `country_conflict` and `country_baseline_conflict`; keep stages and safe diagnostics. Studio/traces show scope, bounded selection/fact counts and Edition metadata, retaining both run IDs and existing ownership. |
| Storage compatibility | Remove the entire `ingestion_runs_report_ck`; application consumers enforce report compatibility. Historical reports, audit JSON, operation keys/hashes/results remain byte-for-byte unchanged. No historical report conversion; catalog operation compatibility belongs to the prerequisite. |

Field registry: Event summary/website/socials; Edition year, dates, scheduleStatus, displayName, venue/address, locality/region/country, coordinates, capacity, classification, tickets, and ticket link. Immutable identities/time zones stay outside proposals. Use typed handlers rather than generic schema traversal.

## Decisions

### 1. Extend the shared refresh workflow

Flow: start durable run → context/baseline/assignment → initial read → research/resolution → validation/guards/proposals → atomic apply → report/finalize. Early rejection skips external work/apply but finalizes started runs. Keep resources in CatalogAttempt, serializable results in native state, and one shared session/budget per Event; no second checkpoint or caller-provided state.

Full retains every saved Edition, including history/farther future, plus at most one missing selected target. Current allows only selected Edition and Event facts. Re-resolution replaces the latest selection and cannot discard mandatory full targets. Both scopes check filled and missing supported fields, Event facts, and announcements.

### Resolver contract

Host supplies immutable `{scope, referenceInstant, savedEditions, fieldRegistry}` from the attempt. The model cannot override them. The strict tool input uses the existing model descriptor names:

```ts
type ScopeInput = {
  candidates: Array<{
    key: string;
    year?: number;
    dates?: { startsOn: string; endsOn: string };
    excluded: boolean;
    reason: string;
  }>;
  unresolved: string[];
  reason: string;
};
type Selection =
  | { status: "selected"; key: string; reason: string }
  | { status: "none-found"; reason: string }
  | { status: "unresolved"; reason: string };
type ScopeOutput = {
  selection: Selection;
  exclusions: Array<{ key: string; reason: string }>;
  assignment: {
    eventFields: string[];
    editions: Array<{ key: string; year: number | null; fields: string[] }>;
  };
};
```

Keys/years/dates/reasons use existing bounds and date-order rules; keys are unique. Field names come only from the host registry. Candidates are inspected-source findings, not copies of saved leads. Use a saved key for a matched Edition and a distinct new key for a supported missing Edition; uncertain matching/order goes in unresolved. `excluded` means source-confirmed cancellation/postponement without replacement dates; reason explains it. Supported replacement dates appear in dates with excluded=false. The host validates shape/keys/order, without proving source association or interpreting reason prose.

The pure resolver applies the selection rules below. Any supplied unresolved selection/matching issue or ambiguous temporal order yields unresolved. Empty candidates with no unresolved issue yield none-found after the model's stated announcement checks; this is not inferred from omitted final facts. Full assignment always includes every saved Edition, plus at most one missing selected Edition; current includes only the selected Edition. None-found/unresolved leave current with Event fields only; full retains saved targets.

Call after announcement checks and before researching the resolved target assignment. Every refresh success/partial final response requires at least one valid call. Reinvoke if later evidence changes matching, eligibility or order; each valid call replaces the latest selection/assignment, rather than merging old candidates. Invalid input returns a tool validation error and cannot authorize new targets. The injected generator receives the same input/output through `resolveRefreshScope(input)` and records state through the same adapter; it cannot bypass resolution by calling the pure function alone.

Before preparing operations, validate final proposals against the latest resolution. Missing resolution, out-of-scope targets, or returned temporal/matching facts contradicting it produce existing host invalid_candidate failure and zero operations. Failed/null-data results and early host failures need no call and still finalize. With unresolved selection, useful in-scope facts may remain partial with an existing model-authored unfinished-selection question; success is rejected. None-found may succeed. Resolution adds no fields to the final agent schema and copies no tool reasons into fact reason/unresolved.

### 2. Select conservatively and preserve keys

Select one ongoing Edition first (inclusive local final day), otherwise nearest future. Capture one instant/Event; use saved time zone or UTC. Recheck saved dates/statuses as leads. Source-confirmed cancellation/postponement without replacement dates excludes a current candidate; supported replacements participate under the same key. Full still checks saved exclusions; current never mutates excluded/skipped Editions.

Ties, overlapping ongoing candidates, uncertain ordering or matching remain unresolved. A single source-backed year-only future announcement may be selected without invented dates. None-found can succeed; useful Event/full facts can remain partial. Match stable keys/source context, never year alone; corrected dates/years and multiple weekends must not create duplicates.

### 3. Recover the website and guard countries

Prompt and assignment input must say: if a saved site belongs to another festival, exclude its facts, find the correct website, and inspect its association with the target Event. Names/search snippets alone are insufficient. After verification, propose website replacement and continue; failure within the shared budget returns failed with null data and existing diagnostics, producing no operations. Source association remains model interpretation; no separate identity output or host declaration gate.

Capture every saved Edition ID/country (uppercase/null); conflicting known baselines fail before external calls. One known baseline constrains every returned in-scope country, including unchanged/new/cleared facts; no known baseline permits filling. Guard after schema/target checks and before diffs/operations. Any conflict vetoes all Event writes, links, publication, audits, and receipts, without year/relocation exceptions.

Reread the complete ID/country set inside the synchronous outer apply transaction; any baseline change aborts all writes. Retain expected versions and dry-run rollback. Durable history stays outside catalog transactions, including failure/no-op/preview. Finalization failure cannot replay or undo committed catalog work.

### 4. Preserve the agent schema and explain through reason/unresolved

Supported facts use the existing `{value,reason}`. Unknown/unverified facts are omitted and explained in existing unresolved questions. `data.reason` remains creation-only; partial still requires an unfinished-check question. Inner null means an explained nullable-field clearing, never absent evidence; optional wire-wrapper nulls are omitted. Links, complete tickets, and classification patches retain current semantics.

The model judges completeness from the assignment. The host checks schema, targets, selection and countries; it never parses reason/question prose or invents per-field completion from omissions. Prompt/offline evals check completeness. Invalid final output fails without commentary salvage.

Exact naming example (the existing schema, unchanged):

```json
{
  "status": "partial",
  "data": {
    "eventName": "Example Festival",
    "sources": [{"url": "https://example.org/festival", "information": "Venue confirmed; ticket shop unavailable"}],
    "links": {"socials": {}},
    "editions": [{"key": "summer-2027", "countryCode": {"value": "PT", "reason": "Official page gives the Portuguese venue"}, "links": {}}]
  },
  "errors": [],
  "unresolved": [{"editionKey": "summer-2027", "field": "tickets", "message": "Ticket verification is unfinished because the shop is unavailable"}]
}
```

Report confirmed/changed only for returned source-supported named facts, comparing normalized state against the complete baseline; host supplies old values/check times. Omitted fields receive no synthetic outcome. Baselines must preserve all typed ticket information, including base-price `coverage: "full_programme"`, to avoid false changes on unchanged prices. Keep verification separate from application outcomes and retain assignment/questions/source summaries on no-op/failure.

Inspect relevant ticket shops/languages; preserve qualified packages/day/upgrades/concessions and base-price eligibility. Omit incomplete replacements that would erase unverified categories.

### 5. Retain limits and accounting

Replace latest/next and missing-only refresh instructions with assignment completion. Preserve shared search/depth/size/deadline, Mastra steps/time, caching, retries, final-step reservation, optional observability, and `--searches/--agent-steps/--seconds`. Pages/modelCalls remain counters; no page cap or per-Edition budgets/chunking.

Never truncate assignments or the existing 20-Edition boundary: detectable oversize fails before research, otherwise before apply. Retain known/zero cost subtotals even with incomplete accounting.

## Risks / Trade-offs

- Breaking private reports → upgrade active consumers together; preserve historical payloads and reject unsupported versions explicitly.
- Incorrect saved country blocks valid research → diagnostic and deliberate manual correction.
- Namesake/ambiguous evidence or budget exhaustion → explicit failure/partial questions and offline regressions; host cannot prove source truth.
- Omitted facts lack completion state → retain assignment and evaluate completeness offline.

## Migration Plan

1. Apply and synchronize rename-occurrence-to-edition first; verify Edition contracts and catalog migration are available.
2. Implement scoped refresh and report v3. Add a separate forward migration removing ingestion_runs_report_ck before writing v3 reports; preserve historical run JSON.
3. Verify offline CLI/Studio parity, durable lifecycle, cancellation/resources, limits and atomic rollback; sync catalog/source-workflow and current docs after apply.
4. Upgrade report consumers and workflow together. For downgrade, restore matching code and a pre-migration DB backup; historical payloads are not rewritten.

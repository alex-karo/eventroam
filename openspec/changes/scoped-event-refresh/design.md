# Design

## Context

Edition naming is implemented. Scoped refresh now uses one model-led final result, without an intermediate resolver or separate fact-verification report. Selection and research completeness are model decisions, while the host owns structural bounds, countries and atomic writing. Existing IDs/keys and agent output remain unchanged.

## Goals / Non-Goals

Use one final research result, without an extra selection tool, callback, checkpoint or proof of completion. Preserve website recovery, typed facts/tickets, publication, budgets and durable lifecycle.

## Contract changes

| Surface | Exact change |
| --- | --- |
| Agent output / provider wire | Unchanged `{status,data,errors,unresolved}`. Facts remain `{value,reason}`; Edition descriptors use `key`, typed `year`, existing tickets/classification/links. Existing reason/unresolved and wire-null semantics remain. No selection/identity output. |
| CLI / Studio / stored input | `add|refresh`; remove `check`. Repeated distinct Event IDs, `scope: "full"|"current"` (default full); Studio defaults to one-Event preview. Reject invalid scope and add+scope before resource/history allocation. |
| Research context / tools | `refresh: {scope,referenceInstant,savedEditions,fieldRegistry,rules,countryBaseline}`. Saved rows retain stable keys, dates and timeZone. `rules` contains host-authored research instructions, not findings. Remove `resolveRefreshScope`, its input/output schemas and injected callback. Only source-reading/discovery tools remain. |
| Host validation | Keep schema/target checks; current returns at most one Edition, full returns at most one key absent from saved Editions, with at most 20 total targets (including mandatory full history). Do not validate temporal choice or infer completeness from omitted facts. |
| Research limits | Remove `modelInputChars` from limits/configuration/reports and `CATALOG_MAX_MODEL_INPUT_CHARS` from environment settings. Default `agentSteps` becomes 15; existing step overrides and final-response reservation remain. |
| Private reports / consumers | v3 contains static refresh context, effective limits and workload. Remove resolution, resolved assignment, selection/exclusions, verification and returnedFacts/verifiedFactCount. Count saved and returned Editions without claiming they were selected or checked. Preserve raw model response, run IDs, outcomes, questions, sources and accounting. |
| Studio / observability | Show scope and saved/returned Edition counts; remove selection fields, resolver tool events and labels. Retain both run IDs and existing safe metadata. |
| Storage | Migration removes the entire DB report check; application readers validate current v3. No historical report conversion or compatibility layer. Existing catalog/audit/run payloads and opaque IDs are not rewritten. |

## Decisions

### 1. One model-led refresh

Flow: durable run → scope/context/country baseline → initial read → research → schema/scope/country guards → atomic apply → report/finalize. Static context and the prompt both state:

- Full rechecks every saved Edition, including history/farther future, plus at most one source-supported missing current Edition. Current rechecks Event facts and at most one ongoing or nearest future Edition. Both check filled/missing supported fields and announcements.
- Choose ongoing first, otherwise nearest future; dates include the local final day using saved timeZone or UTC fallback. Saved dates/statuses are leads, not source proof.
- Reuse saved keys for matched Editions, including corrected dates/year and multiple weekends. Year alone is not identity.
- Only source-confirmed cancellation/postponement without replacement dates excludes a current target; supported replacements keep its key. Full still checks saved exclusions.
- Resolve ties, overlaps and uncertain matching/order within the shared budget. If ambiguity remains, propose no arbitrary current target and explain the unfinished question in existing unresolved; useful Event/full facts can be partial. Completed announcement checks with no eligible target can succeed without an Edition proposal.

There is no mandatory intermediate call, recorded selection or final-response comparison against a prior decision. The context is the task and saved input, not evidence that the model chose correctly. Deterministic model-response fixtures and fixed-source model evals test temporal choice and research completeness; the host checks only simple bounds.

### 2. Website recovery and atomic countries

If a website belongs to another festival, discard its facts, find the correct site and inspect its association. Name/snippet alone is insufficient. Continue after verified recovery; otherwise return failed/null with existing errors/unresolved and zero operations.

Capture every saved Edition ID/country (uppercase/null). Conflicting known baselines fail before external calls. Any known sibling constrains all returned country facts, including new/unchanged/null values. Conflicts veto all writes. Reread the complete ID/country set inside outer atomic apply; any change aborts all operations. Retain expected versions, preview rollback, independent durable finalization and no write replay after persistence failure.

### 3. Existing facts and honest reports

Omitted facts preserve values; inner null clears only nullable facts with positive evidence. Partial requires an unfinished-check question. No parser interprets reason/question prose or invents field-completion outcomes.

Returned facts, including unchanged values, remain in the raw model response. The existing writer produces changes and attributable audit entries for actual mutations; no separate confirmed/changed comparison, normalized old/new verification, checkedAt or replacement mechanism is added. Preserve typed ticket baseline, full-programme coverage and complete qualified categories; omit replacements that would erase unverified categories.

Workload counts describe static saved context and final proposals. They do not certify selection or completeness. Reports retain model status/questions/source summaries even on no-op/failure.

### 4. Shared limits

Keep one Event budget, caching, retries and final-step reservation. Remove application input-character counting and its configuration/report field. Default to 15 ordinary model steps, retaining step overrides and existing search/depth/source-size/output/deadline limits. Provider context-window errors remain model failures. No page cap, per-Edition budget or silent history truncation. Detect full history beyond 20 before external work; reject an oversized final full target union before operations.

## Risks / Trade-offs

- Temporal selection is no longer enforced by deterministic host code → source-backed evals for ongoing/local dates, ties, cancellations/replacements and stable keys.
- Mutation scores do not prove research completeness → add separate eval assertions for raw returned unchanged history and unfinished checks; do not add a host omission gate.
- Incorrect saved country blocks research → explicit diagnostic and deliberate manual correction.
- Budget exhaustion or ambiguous source evidence → existing failed/partial semantics; preserve usable findings and unfinished questions.

## Migration Plan

Remove the intermediate resolver protocol, update affected tests and current v3 consumers together, then sync the owning spec/docs. Keep the existing report-check-removal migration and historical JSON untouched. Verify CLI/Studio parity, provider final-step behavior, scoped bounds, atomic rollback, model selection/completeness evals and the normal project checks. No owner database execution or deployment.

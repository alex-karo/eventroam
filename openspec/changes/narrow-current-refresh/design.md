# Design

## Context

Research and editor share `modelContext` from `research/agent/input.ts`. It strips storage administration but retains full saved facts. The host validates target/count/country boundaries; temporal selection remains model-owned. See [proposal](proposal.md) and [delta specs](specs/catalog/source-workflow/spec.md).

## Goals / Non-Goals

Narrow current research without removing editorial preservation context. Keep add/full behavior, output/editor contracts, reports, guards, tools and budgets unchanged. Clarify the editor current assignment without changing its fact context.

## Decisions

### Separate research projection

Keep `modelContext` for full research and editor. Select a smaller projection only for refresh/current; omitted scope remains full.

Retain Event identity/links and every saved Edition's key, year, display name, dates/state/status/time zone, venue/locality/area/country, coordinates/precision, links, terms and complete major-unit tickets with qualifications. Omit Event summary/homeScope/publicationState and Edition publicationState/venueAddress/sizeEstimate. Loaded snapshots, known links and initial reads remain unchanged.

Filtering Editions by saved dates could lose corrected or same-year keys; narrowing the shared projection would remove editor preservation facts. Retaining all ticket/taxonomy baselines limits compression but preserves safe replacements and donor choice.

### Scope-specific instructions

Revise assignment, completion, recovery and classification clauses together. Current assumes a prior full established identity/shared links and checks announcements/selection and selected-Edition dates, status, location, tickets and classification. Historical pages serve matching, selection or taxonomy continuity; size, coordinates and detailed address need no separate research.

Completed checks may succeed with unknown facts or no eligible Edition. Unfinished mandatory selection/checks with useful sources produce partial; no usable inspected findings produces failed/null. Diagnostics never substitute for structured facts.

### Explicit taxonomy reuse and trusted identity

Reuse requires a complete classification finding whose reason names the preceding comparable donor and inspected continuity basis. Revise refuted terms; uncertain comparability cannot justify copying. Existing editor and publication checks apply; omitted classification triggers no inheritance.

Prior full is an operating precondition; do not add stored flags or verify run history. Current trusts Event identity/shared links without re-auditing them. If inspected evidence materially contradicts identity, stop with failed/null and an identity question requesting full; do not discover replacement sites or send Edition findings to the editor. Unavailable sources are diagnosed without website recovery. Full retains verified recovery and Event-link correction. Existing identity/country/write guards remain.

### Editor current assignment

Current editor plans contain only the selected research key, or no Editions when selection is empty. Preserve history by omission; preservation-only entries belong to add/full. Keep schemas, context and guards unchanged and version prompt changes.

### Evaluate findings and writes

Add raw absent-field assertions: absent/outer wire-null means omission; inner value:null remains a finding. A forbidden current Event finding must fail scoring even when the editor prevents its write. Keep existing catalog-change assertions.

Extend fixture ticket fields/seeding only as needed for complete saved blocks; retain fixture schema 2. Cover scope omissions/completion, no target/ambiguity, taxonomy continuity/change/noncomparability, current identity-stop/full recovery and ticket preservation. Retain existing temporal/full-history regressions. Full-pipeline evals exercise the changed research; editor-only replay does not.

## Risks / Trade-offs

- Semantic violations can pass structural guards → score raw findings and writes.
- Reuse can carry stale taxonomy → require inspected continuity and contrasting donor cases.
- Compact context can lose matching clues → retain all keys and baselines; compare full/current serialized inputs without promising fixed savings.
- Current relies on a valid prior full baseline → an observed identity contradiction stops the run and requests full; unavailable sources do not trigger recovery.

## Migration Plan

No data migration. Land prompts, projection, tests and docs together; verify before synchronizing main specs. Revert prompts/projection together if matching or preservation regresses.

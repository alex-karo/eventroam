# Proposal

## Why

Current refresh still researches Event fields and receives full historical context, overlapping with full refresh. Narrowing the model assignment makes current useful for preparing one ongoing or upcoming Edition with less unnecessary research and input.

## What Changes

- **BREAKING** research assignment: current omits Event summary/shared-link proposals and researches at most one ongoing Edition, otherwise the nearest announced future Edition. Full retains Event and all saved Edition verification plus at most one missing selected Edition.
- Current prioritizes announcements, dates, schedule status, location and complete ticket information. Capacity, precise coordinates and detailed address are opportunistic; history is consulted only for matching, selection or classification reuse.
- Preserve an existing selected Edition's taxonomy unless evidence supports changes. For a new Edition, let the model explicitly reuse the nearest preceding comparable Edition's taxonomy after checking the current announcement for material programme/format changes; explain reuse in existing reasons.
- Supply compact current context without Event description, administrative metadata or unnecessary historical detail, retaining stable matching keys, temporal/country context and saved ticket baselines needed for safe replacements.
- Keep wrong-site discovery/inspection mandatory. Current uses a verified replacement as a source and notes the saved-link correction in diagnostics; only full proposes the Event link update.
- Keep the output schema, reason/unresolved semantics, report version, 15-step default and all downstream checks/preparation/writes unchanged. Scope adherence is a model responsibility measured by evals.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Different full/current research duties, compact model context, completion criteria and recovery output.
- `catalog/classification`: Explicit model-proposed reuse of a preceding Edition's taxonomy for a new current Edition, without automatic inheritance.

## Impact

Implementation affects `src/ingestion/research/agent/prompt.ts`, `agent/input.ts`, their tests, model eval fixtures/scoring and ingestion documentation. CLI/Studio inputs, final response schema, `validateRefresh`, operation preparation, writer, database and report structure remain as established by the archived scoped-refresh follow-up (top-level scope/referenceInstant; no refresh object). No separate refresh context, new tools, host selection protocol or scope-specific budgets.

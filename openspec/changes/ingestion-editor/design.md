# Design

## Context

Today: research -> `prepareResearch` -> transactional writer. Preparation combines interpretation, conversion and publication decisions. This change inserts an editor and replaces preparation with explicit typed conversions; the writer keeps its integrity guarantees. See [proposal](proposal.md) for scope and [delta spec](specs/catalog/source-workflow/spec.md) for acceptance scenarios.

## Goals / Non-Goals

**Goals:** Clear decision ownership, less write-preparation logic, better factual updates.

**Non-goals:** Writer rewrite, generic patch engine, entity deletion, automatic withdrawal, new storage, editor tools, retry loops or human review queues.

## Agent contracts

Application-level type sketches; domain types abbreviate detailed structures. Provider schema and wire normalization are implementation details; normalization preserves omission.

### Research input

```ts
// Renames referenceInstant; shared with editor, workflow state and report v5.
currentDate: string; // ISO 8601 timestamp, fixed once per run
```

### Research output

```ts
// Named fact wrappers within ResearchResult.data.
type Finding<T> = {
  value: T | null;      // null only where supported: saved value disproven,
                       // no replacement known; never a write command
  reason: string;
};
```

Omission means unknown/unverified. Evidence stays in `sources[].information`; findings carry only value/reason, without per-field source references. Classification retains add/remove suggestions; tickets require a complete block, with partial findings in source summaries/unresolved.

### Editor input/output

```ts
type EditorInput = {
  research: ValidatedResearchResult;
  catalog: SavedCatalogContext | null; // Relevant Event/Edition; null for add
  vocabulary: ClassificationVocabulary;
  mode: IngestionMode;
  scope: RefreshScope | null; // null for add
  currentDate: string; // ISO 8601 timestamp, fixed once per run
};

type EditorOutput = {
  event: EventPlan | null; // null only when declining creation in add
  editions: EditionPlan[];
  unresolved: ResearchQuestion[]; // Existing message + optional editionKey/field
};

type EventPlan = {
  target: { eventId: EventId } | { create: NewEventIdentity; reason: string };
  fields: EventFieldActions;
};

type EditionPlan = {
  target: { editionKey: EditionKey } | { create: NewEditionIdentity; reason: string };
  fields: EditionFieldActions;
};

type Action<T> =
  | { action: "set"; value: T; reason: string } // Valid, non-null value
  | { action: "keep"; reason: string };

type ClearableAction<T> = Action<T> | { action: "clear"; reason: string };

// Field action types enumerate optional named domain fields, e.g.:
// venueName?: ClearableAction<string>
// tickets?: ClearableAction<TicketBlock>
// No arbitrary field paths; clear is available only where permitted.
```

Creation follows add/refresh limits. To decline Event creation in add, return `event: null`, `editions: []` and an explanation in `unresolved`: report skipped without writes. Refresh requires its existing Event target. Omitted fields preserve content without claiming verification; `keep` adds an explanation when useful. Dates/coordinates are grouped; tickets/classification are complete intended replacements preserving unchallenged saved entries. Clear empties the corresponding block where allowed. Links address owner/kind slots.

Input excludes research conversations/full pages. Output excludes overall apply/keep, existing-target update/keep, duplicate source references, generated IDs, operation keys, versions and publication commands. Technical failures are host-reported.

## Decisions

### Execution and writes

Research -> edit -> prepare plan -> apply. Failed/invalid research, country rejection and duplicate add skip editing. The editor makes at most one generation with existing model settings/output limit and the shared deadline: no tools, retries or fallback to research writes. Insufficient evidence means preserve and explain; independent supported changes can proceed.

Replace the old mutation path with a few typed conversions into existing operations. Remove implicit deletion interpretation, host classification patch folding and unused/duplicated writer code; retain necessary research wire parsing. Avoid a universal interpreter or a parallel legacy path.

Code owns IDs, slugs, versions, operation keys, money/URL conversion and publication. Preserve target/scope checks, stable identity/time-zone protections, raw country checks before editing, final-plan checks, transaction-time baseline checks, domain validation, receipts, no-ops and atomic audit. A known-country refutation (`value:null`) fails before editing; omission does not. An invalid plan/item is rejected as a whole.

### Publication

For a valid plan, evaluate addressed Editions and their owning Event; do not sweep unrelated Editions. Return a considered but preserved Edition with its target and `fields: {}`. An Edition omitted entirely is not processed, including for publication. Kept content can publish when eligible. Withdrawn records still require `republish`; clear cannot bypass publication constraints. Publication-only changes report published, otherwise no changes report unchanged. Dry-run previews the same operations without retaining writes.

### Reporting

Report v5 keeps research output and `editorResponse` once; its structured object is the plan. Retain invalid output with validation errors, never a second serialized validated-plan copy or silently corrected decision. A parsed plan may exist transiently for execution.

Keep `editorStatus` (success/failed/not_run), staged errors and existing writer diffs. Editor failure preserves research status/known usage but fails the run without writes. Missing responses are null. Add editor usage to existing totals; retain shared configuration and editor prompt version, without per-agent metrics. Correct stale diagnostic labels and preserve content exclusions; defer expanded observability. No database migration or old-report compatibility adapter.

### Quality check

Save baseline before changing contracts. Compare five cases once before/after: wrong year, day-ticket price, justified clearing, unavailable source and a valid update. Retain fixtures, revision/settings, expected/actual writes and total cost/duration using existing evals. This is a smoke comparison, not statistical evidence. Keep deterministic regression tests for guards, block preservation and writer invariants.

## Risks / Trade-offs

- Missing or mistaken research evidence -> editor may share the error; preserve uncertain fields and test actual writes.
- Added latency/cost -> one tool-free generation, compact input and existing deadline/accounting.
- Lost saved entries or valid updates -> test replacement preservation and the valid-update case.
- `narrow-current-refresh` overlap -> reconcile its scope/context if implemented first.

## Migration Plan

Capture baseline; update contracts, workflow, reports and docs together; validate and sync the owning spec after implementation. Rollback restores prior code; historical reports remain stored but cross-version reading is unsupported. Implementation follows the approved tasks; the change remains active until archived. Report v5 follows the participant-size contract (v4) added to main during implementation.

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
  value: T; // Nullable only for supported fields: saved value disproven,
            // no replacement known; never a write command
  reason: string;
};
classification?: Finding<TermId[]>; // Complete intended Edition classification.
```

Omission means unknown/unverified. Evidence stays in `sources[].information`; findings carry only value/reason, without per-field source references. Classification uses `Finding<TermId[]>`, a complete intended list preserving unchallenged saved terms; tickets require a complete block, with unfinished checks in source summaries/unresolved.

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

type EditorOutput = EditorPlan | { status: "rejected"; reason: string };

type EditorPlan = {
  status: "ready";
  event: EventPlan | null; // null only when declining creation in add
  editions: EditionPlan[];
  unresolved: ResearchQuestion[]; // Existing message + optional editionKey/field
};

type EventPlan = {
  reason?: string; // Required when creating the Event.
  fields: EventFieldActions;
};

type EditionPlan = {
  editionKey: EditionKey;
  reason?: string; // Required for a key absent from the saved catalog.
  fields: EditionFieldActions;
};

type Action<T> =
  | { action: "accept" } // Copy the same-field research finding
  | { action: "set"; value: T; reason: string } // Supported editorial transformation
  | { action: "keep"; reason: string };

type ClearableAction<T> = Action<T> | { action: "clear"; reason: string };

// Field action types enumerate optional named domain fields, e.g.:
// venueName?: ClearableAction<string>
// tickets?: ClearableAction<TicketBlock>
// No arbitrary field paths; clear is available only where permitted.
```

Creation follows add/refresh limits. To decline Event creation in add, return `event: null`, `editions: []` and an explanation in `unresolved`: report skipped without writes. Refresh uses the Event fixed by the validated assignment; add creates it with the research eventName. Editor does not return Event IDs or names. Edition keys resolve against the saved catalog: saved keys update, new keys create only with matching research and a creation reason. Event creation also requires a reason. Nested target/create objects are invalid. Omitted fields preserve content without claiming verification; `keep` adds an explanation when useful. Dates/coordinates are grouped; tickets/classification are complete intended replacements preserving unchallenged saved entries. Clear empties the corresponding block where allowed. Links address owner/kind slots.

Input excludes research conversations/full pages. Output excludes overall apply/keep, existing-target update/keep, duplicate source references, generated IDs, operation keys, versions and publication commands. Technical failures are host-reported.

## Decisions

### Execution and writes

Research -> edit -> prepare plan -> apply. Failed/invalid research, country rejection and duplicate add skip editing. The editor makes at most one generation with existing model settings/output limit and the shared deadline: no tools, retries or fallback to research writes. Insufficient evidence means preserve and explain; independent supported changes can proceed.

Replace the old mutation path with a few typed conversions into existing operations. Remove implicit deletion interpretation and unused/duplicated writer code; retain necessary research wire parsing. Avoid a universal interpreter or a parallel legacy path.

Code owns IDs, slugs, versions, operation keys, money/URL conversion and publication. Preserve target/scope checks, stable identity/time-zone protections, raw country checks before editing, final-plan checks, transaction-time baseline checks, domain validation, receipts, no-ops and atomic audit. A known-country refutation (`value:null`) fails before editing; omission does not. An invalid plan/item is rejected as a whole.

### Publication

For a valid plan, evaluate addressed Editions and their owning Event; do not sweep unrelated Editions. Return a considered but preserved Edition with its editionKey and `fields: {}`. An Edition omitted entirely is not processed, including for publication. Kept content can publish when eligible. Withdrawn records still require `republish`; clear cannot bypass publication constraints. Publication-only changes report published, otherwise no changes report unchanged. Dry-run previews the same operations without retaining writes.

### Reporting

Report v5 keeps research output and `editorResponse` once; its structured object is the plan. Retain invalid output with validation errors, never a second serialized validated-plan copy or silently corrected decision. A parsed plan may exist transiently for execution.

Keep `editorStatus` (success/failed/not_run), staged errors and existing writer diffs. Editor failure preserves research status/known usage but fails the run without writes. Missing responses are null. Add editor usage to existing totals; retain shared configuration and editor prompt version, without per-agent metrics. Correct stale diagnostic labels and preserve content exclusions; defer expanded observability. No database migration or old-report compatibility adapter.

### Runtime and storage decisions

Keep OpenRouter model transport and the local CLI/loopback Mastra Studio entry points. Mastra owns agent iteration and generation-time limits; reserve the last allowed step for final output. The existing deadline still bounds source/discovery work and retry waits. Avoid a second ordinary-call limiter or generation timer.

Initialize each attempt after engine run creation. Use one serializable native workflow state for phase results and the frozen currentDate, rejecting caller-provided initialState. Keep page Markdown only in the in-memory source session; workflow state and phase outputs retain retrieval metadata without page bodies, including on failure or cancellation. Keep country checks against the saved catalog snapshot without a separate refresh-context object, field registry, selection resolver or attempt-owned checkpoint. Load execution dependencies only when executing, so inspection stays independent of credentials/catalog access.

Use the shared Mastra PinoLogger with child run/source context and explicitly selected application records; disable automatic SDK log export. Producers select bounded fields directly, and `shrinkText` limits selected commentary/reasoning to 4,000 Unicode code points. Suppress sensitive automatic span content at its source or fail closed at export. A generic projection framework, recursive payload processor and event registry add no required behavior.

Keep local logs/traces in DuckDB separate from the catalog. Recording and inspection use sequential access when required; Studio owns its shared store, while attempts finish only their owned observations. Current private run storage uses ingestion_runs with an open text mode and nullable Event association without a foreign key. The existing migration removes ingestion_runs_report_ck; application finalization validates the active report and run correspondence without rewriting historical JSON.

### Quality check

Save baseline before changing contracts. Compare five cases once before/after: wrong year, day-ticket price, justified clearing, unavailable source and a valid update. Retain fixtures, revision/settings, expected/actual writes and total cost/duration using existing evals. This is a smoke comparison, not statistical evidence. Keep deterministic regression tests for guards, block preservation and writer invariants.

## Risks / Trade-offs

- Missing or mistaken research evidence -> editor may share the error; preserve uncertain fields and test actual writes.
- Added latency/cost -> one tool-free generation, compact input and existing deadline/accounting.
- Lost saved entries or valid updates -> test replacement preservation and the valid-update case.
- `narrow-current-refresh` overlap -> reconcile its scope/context if implemented first.

## Migration Plan

Capture baseline; update contracts, workflow, reports and docs together; validate and sync the owning spec after implementation. Rollback restores prior code; historical reports remain stored but cross-version reading is unsupported. Implementation follows the approved tasks; the change remains active until archived. Report v5 follows the participant-size contract (v4) added to main during implementation.

## Live-run corrections

The editor owns the final festival-identity decision from research evidence and saved context. It returns `status:rejected` with a reason for a wrong festival or unresolved material identity contradiction; the host blocks all writes/publication, retains the response and reports a failed item with successful editor generation. Research uses saved location as recovery leads and passes identity contradictions through sources/unresolved, without a new identity error code. Editorial accept/set/clear requires a structured finding for the same owner, Edition key and field; summaries cannot create additional facts. Preserved Editions without findings still allow keep/omission and publication checks.

`TicketVariant` permits `amount: 0` without `currency` for free admission; positive amounts still require currency, and currency alone is invalid. Optional wire null normalizes to omission. The same rule applies to research, editor and catalog writes.

## Compact context and editor evaluation

Both agents receive an explicit projection of catalog identity and facts, including all saved Editions, local time context, links, classification and complete ticket blocks. Database versions, timestamps, storage IDs and administrative columns remain host-only. This does not narrow current/full assignments.

The existing eval runner also supports editor-only mode: replay a captured, versioned research handoff via candidate injection and run the real editor/preparation/writer against fixture state. Reports label the mode and handoff provenance/hash; no live research or source discovery runs. Keep full-pipeline smoke evaluation separate. Replayed research contributes no provider charges; injected research accounting remains explicitly partial rather than claiming complete end-to-end usage.

Strict model providers require an object root for editor transport. The provider-only schema reuses required Event, Edition and unresolved fields from the ready contract: both lists are always arrays. Rejected output uses event:null and empty lists as placeholders, removed before local validation. Local discriminated-union validation still enforces branch requirements and rejects nonempty fields from the wrong branch. Raw editor output remains retained once.

## Accepting and editing findings

`accept` resolves only the same owner/Edition key/field to a non-null research value; missing or refuted findings invalidate the whole plan. Preparation inherits the finding reason (link acceptance uses an explicit research-link explanation), validates the resolved field against the editor contract, and then generates existing operations. One typed pass resolves actions and checks same-field support; it returns a valid concrete plan or a field issue, without reparsing the whole plan or asserting a resolved plan type. Writer receives only concrete operations. Report retains the original editor response once.

Array/block accept copies the complete finding; set replaces the complete value without automatic merging. Classification follows the same complete-value rule; research preserves unchallenged saved terms, and editor checks preservation or supplies a corrected complete list. Editions are keyed decisions, never an array replacement: omitted Editions are untouched, new addressed keys require matching research and a creation reason, deletion is unsupported.

Editor set may transform supported findings, not invent facts. URL edits may remove clearly tracking parameters or select a supplied official URL, but must preserve semantic parameters and cannot invent domain/path changes or confuse official-site and ticket slots. Text may be rewritten without changing facts; dates/location/prices may be normalized without guessing missing parts. Lists may be deduplicated and assembled from supported findings and unchallenged saved entries. These semantic decisions belong to editor instructions, not another host evidence checker.

## Source traversal simplification

Remove the source-link depth limit, per-URL ancestry tracking, environment setting and depth diagnostics. Research may follow relevant links while the shared deadline and existing agent-step, search, source-size and output limits permit. Source sessions retain caching, read history and request accounting; retries and Firecrawl fallback still check the deadline. No replacement traversal policy or compatibility adapter is added.

## Review corrections

Explicit editor rejection remains a successful model generation but a failed editorial plan: preparation logs rejection and the final trace identifies it even after partial research. Source regression evals check the final preserved date state and reject any invented known ticket availability; no additional host evidence checker is introduced.

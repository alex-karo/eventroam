# Tasks

Implement the requirements and [acceptance criteria](proposal.md#acceptance-criteria) in the proposal. Use the [design](design.md) for contracts and execution flow.

## 1. Scope definition, presets, and durable input

- [x] 1.1 Add typed scope and task validators and the field registry for string targets event, currentOrNext, and latestCompleted. Verify tasks without instructions, rejection of blank supplied instructions, and early rejection of unknown properties, unsupported versions or selectors, non-string targets, wrong-entity fields, scalar tasks, and empty task or field lists. Invalid input creates no attempt or provider call.
- [x] 1.2 Retain submitted preset names or custom objects in jobs and attempt input. Compare dispatch input by value with the accepted request. Normalize scope once at execution and save NormalizedScope directly before external work; use the submitted request for preset origin. Using existing JSON columns, verify execution-time presets, unchanged custom tasks and order on retry, omitted instructions, legacy name-only jobs, preserved settings, current temporal selection, and fixed attempt scope and history.
- [x] 1.3 Produce NormalizedScope directly and derive field assignments and requested slot permissions while retaining the task list and supplied instructions. Default required values without adding missing instructions. Verify the direct normalized shape, shared slot bindings, independent field assignments, and rejection of repeated target/field pairs within or across tasks without overrides.
- [x] 1.4 Ship full and current as typed task presets through the same validators. Replace preset-name assignment branches with the normalized definition. Verify field coverage, required checks, and opportunistic work against existing full/current fixtures. Use the shared execution rules for both presets.
- [x] 1.5 Document task objects with string targets, optional instructions, and preset definitions in `docs/ingestion-process.md`. Verify examples with and without instructions, shared selectors, and separate field checks.

## 2. Temporal selectors and fixed slots

- [x] 2.1 Map currentOrNext and latestCompleted to the existing currentOrNextEdition and previousEdition slots. Keep those target contracts across roles, Location points, proposals, and Editor. Use named target references without requestId or array indices. Verify that task reordering preserves target associations and field keys, unassigned slots do no selection, and repeated-selector tasks share one binding through review and returns.
- [x] 2.2 Resolve requested slots with the existing evidence and date rules. Reuse tests for local-day boundaries, cancellations, incomplete dates, durable keys, confirmed absence, and the same-Edition slot guard. Verify early rejection of saved-ID selectors and latestCompleted ticket tasks, no substitution, and no writes after an invalid binding.
- [x] 2.3 Update target-selection guidance in `docs/ingestion-process.md`. Verify the selector-to-slot mapping, absent and unresolved outcomes, deferred saved-ID research, and ticket restrictions. Keep supporting context outside write permissions.

## 3. Scope through collection and review

- [x] 3.1 Derive stage inputs from the fixed scope and pass assigned tasks into Research and the first Reader call before navigation. Use standard field rules for omitted instructions and preserve supplied instructions through General, specialists, Editor, and bounded returns. Capture call inputs to verify instructions, boundaries, frozen date, and later bindings.
- [x] 3.2 Derive specialist calls, output fields, relevant context, and checks from the field owner registry. Verify one initial call per assigned owner for all its eligible tasks, preserved bounded returns, no extra workflow per task, description-only work without Edition selection or unrelated specialist/geocoding calls, and no classification vocabulary for that work. Verify that link-only work makes no ticket model call.
- [x] 3.3 Use each existing proposal group's path for field checks, Editor review, return matching, and reports. Remove fixed named-check lists and their field-path mapping. Keep collection and interpretation findings separate. Verify identical field keys across these consumers, independent fields, stable slot keys regardless of task order, no missing checks for unassigned fields, and partial research when a required source check remains unfinished after interpretation.
- [x] 3.4 Restrict Editor returns and original or revised proposals to assigned groups and fixed bindings. Reuse return-path tests and add scope-violation cases that prove no return can add a field or change a target. Retain the current selective source checks and return rules.
- [x] 3.5 Update `docs/source-reader.md` and the agent flow in `docs/ingestion-process.md`. Verify that they describe shared task instructions, requested extraction, necessary context, unchanged whole-page evidence, field-path keys, separate collection and interpretation findings, and explicit skipped-role outcomes.

## 4. Allowed changes and shared execution rules

- [x] 4.1 Enforce scope at proposal and catalog preparation, including logical changes inside replacement operations. Verify independent description fields and link slots, complete dates/classification/location/ticket groups, and rejected changes to omitted dependent fields.
- [x] 4.2 Apply the shared creation, publication, source recovery, and independent Event rules from the design. Remove legacy refresh gates and recovery branches by preset name. Verify saved Edition reuse, temporal creation and missing-field dependencies, normal publication for accepted assigned Editions and their parent Event, unchanged eligible targets, Event-only publication preservation with an already published saved Edition, recovery without a website write, full without Editions, and current without a usable target. Retain add's Edition prerequisite, preview, republish limits, and observed or concurrent country guards. Reuse transaction tests to confirm scope failures leave catalog, audit, and receipts unchanged.
- [x] 4.3 Document shared execution rules and unresolved dependencies in `docs/ingestion-process.md`. Verify that examples explain creation from temporal targets, publication boundaries, source recovery, and independent Event work. State the approved changes to full/current and the absence of separate custom effect controls.

## 5. CLI, Studio, and chat input

- [x] 5.1 Add the preset-or-object request contract to Studio refresh input. Keep CLI full/current presets and the full default. Verify Studio task objects and existing command transport tests, including unchanged add input.
- [x] 5.2 Extend refresh job submission and the Studio chat tool to accept the same scope request. Verify one accepted job per resolved Event, whole-batch validation, preserved tasks and instructions, and no automatic resubmission after an unknown outcome.
- [x] 5.3 Update Studio assistant guidance to select a preset or build a custom task object from an ordinary request. Add instructions only for extra task detail. Document the flow and direct-input options in `docs/ingestion-tools.md`. Verify description-only, multiple-field, and preset requests without owner-written structured input, unchanged CLI options, and an explanation of deferred saved-ID research without silent substitution. Keep queue/chat republish off.

## 6. Report consumers

- [x] 6.1 Generate version 8 reports with the normalized definition directly, outcomes under existing slot names, existing proposal paths as field keys, separate collection and interpretation findings, and skip reasons. Update report and evaluation consumers and retain version 7 inspection with its original check keys. Verify bound, absent, unresolved, and not-run cases without inventing old scope data or duplicating cost totals.
- [x] 6.2 Update saved-run guidance in `docs/ingestion-tools.md` and the Studio catalog SQL skill for both report versions, stored scope requests, and effective attempt scope. Verify the documented queries with version 7 and version 8 fixtures. Document the coordinated deployment and rollback limit in the ingestion guide.

## 7. Integration checks

- [x] 7.1 Run a deterministic refresh through each input adapter, queue execution, agent flow, atomic writer, and report reader. Verify tasks with and without instructions, shared instructions across fields, repeated-selector tasks with one binding, description-only boundaries, unchanged CLI options, and full/current results under the shared rules. Include add's unchanged internal full assignment and duplicate skip. Compare invoked work on the same source fixtures without requiring paid live runs or a fixed savings percentage.
- [x] 7.2 Run the relevant ingestion, command, assistant, queue, and report tests plus `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run deps:check`, `pnpm run docs:check`, and `pnpm run openspec:validate -- yaml-research-scope`. Verify acceptance criteria coverage, no stale scope-name branches, and continued use of the existing two target slots throughout the role, review, write, and report contracts.

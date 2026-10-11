# Tasks

## 1. Vocabulary and classification

- [x] 1.1 Add four topics and openair format to fresh development/eval vocabularies, update fixture references, and verify seed repeatability.
- [x] 1.2 Add activity evidence rules to the research prompt and review the ski-pass rule and outdoor format distinction; update the vocabulary document's implementation note.

## 2. Publication and integration

- [x] 2.1 Update both publication checks and test eligible openair/mixed formats versus outdoor topic and legacy format; synchronize owning specs around facet independence and publication behavior, keeping individual term definitions in the vocabulary and prompt; verify OpenSpec validation.
- [x] 2.2 Run tests, type-check, lint, formatting and documentation checks; confirm no migrations or database files changed.

## Verification results

- The full suite passed before the test simplification. Per-term seed checks and prompt-text assertions were removed at the owner’s request; only publication behavior tests distinguish format from activity topic. Affected tests passed after simplification.
- Lint, formatting, docs:check, openspec:validate, and git diff --check passed.
- Full type-check reports existing obsolete `gaps` references in four ignored local experiment scripts under data/. Project type-check with data/ excluded passed; those scripts were not edited.
- No migration files or existing databases were changed. Live model evals and browser tests were not needed for this vocabulary/publication change.

- After integrating updated main: 478 tests passed across 43 files; type-check, lint, formatting, docs:check, openspec:validate, and diff checks passed in the clean temporary worktree. Activity guidance was moved into the refactored agent/prompt.ts module. Checks used the available Node 26.11.1/npm 11.20.0 runtime without changing the repository runtime pins.

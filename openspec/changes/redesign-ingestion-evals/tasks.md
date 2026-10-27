# Tasks

Implement in order. Use the [design](design.md) for decisions and the [spec](specs/operations/ingestion-evaluation/spec.md) for behavior. Checks use model substitutes; paid model runs are not required.

## 1. Establish experiment storage

- [x] 1.1 Add a compatible LibSQL adapter and local eval store. Verify saved results and numeric scores across restart with a deterministic experiment covering correct/wrong results, N/A, and a task execution failure. Confirm the catalog database is untouched. Keep this check in the integration test; add no custom storage-failure handling.
- [x] 1.2 Connect eval storage domains to existing Studio. Verify saved results are readable while observability and ingestion guards still work. Document storage paths and launch steps in `docs/development.md`; run `npm run docs:check`.

## 2. Define groups and main gold

- [x] 2.1 Add suite, origin, and task metadata. Keep all 51 cases and regression expectations. Test six main, 25 regression pipeline, seven regression editor, and 13 regression Location selections. Preserve Location completion/correction/preservation labels.
- [x] 2.2 Add typed gold and preflight validation. Write gold for all six captured cases with source notes. Verify field policies, alternatives, unknown/absent distinctions, and conflicts.
- [x] 2.3 Document required/additional units and the ticket boundary in the eval guide. Verify the documented examples agree with gold and run `npm run docs:check`.
- [x] 2.4 Add source-backed normalized geocoding fixtures needed by main cases, with provenance. Reuse fixed request matching and existing Location tests for initial/agent fixture misses and captured no-match/error results. Verify the new main fixture inputs; tasks 3.1 and 4.1 cover main execution and revision changes. Document the fixture boundary.

## 3. Score main results

- [x] 3.1 Add isolated main apply through Research, Editor, Location, and the writer, with catalog snapshots. Retain workflow regression dry runs and isolated Location execution. Verify fresh state per attempt, protected and extra records, Edition bindings, rollback, and main failure on geocoding fixture misses. Reuse existing Location tests.
- [x] 3.2 Implement structured facts, URL alternatives, and simple ticket comparisons. Use injected outputs to test omissions, false values, duplicates, ambiguous offers, and independent base-price checks. Verify that base price earns no completeness credit and each failed factual check adds an error.
- [x] 3.3 Compute main metrics and conditions once; expose thin Mastra scorers, including binary no-checked-errors. Keep raw error counts in diagnostics. Keep regression pass/fail and diagnostics. Test N/A, optional omissions, missing verification, expected refusals, and unexpected errors. Update score documentation and run `npm run docs:check`.

## 4. Run and compare groups

- [x] 4.1 Load file-owned cases into revision-specific datasets with stable case/repetition IDs. Test repeat imports, altered stored data, resolved page/search/geocoding changes, complete Location inputs, gold changes, and scorer-version changes before provider setup.
- [x] 4.2 Run all four groups from one CLI command and persist their real outputs, observations, metadata, and scores. Default to six main cases and one repetition; add `--all` for all 51 cases. Keep explicit editor and Location selection. Remove the eval JSON report builder, file writer, and `--report` option. Test default/full selection, valid siblings after a Location failure, separate Location subgroups, and quality/execution exit codes.
- [x] 4.3 Show selected groups and case counts, separate summaries, failed checks, N/A counts, experiment IDs, and duration. Document selection, report removal, Studio comparison, and equal-repeat/revision limits. Include errors-before-completeness guidance, three recommended main repetitions, all 51 cases for both models before replacement, and regression review. State the coverage limit and failure-driven suite growth. Check two saved experiments in the built-in browser; run `npm run docs:check`.
- [x] 4.4 Apply explicit `--model X` to all three stages; retain environment resolution without the flag. Test precedence over `CATALOG_LOCATION_MODEL` in combined and isolated Location runs. Retain run IDs, available trace IDs, resolved stage models and prompt versions, reasoning effort, service tier, and limits. Reuse existing observability and its tests for tracing and token/cost collection. Limit new checks to model selection and saving/reopening experiment metadata and run/trace IDs. Document model selection and link the metrics guide; run `npm run docs:check`.

## 5. Validate delivery

- [x] 5.1 Exercise the complete all-groups flow with model substitutes. Verify main scores, unchanged regression decisions, stored result inspection, and input/database isolation. Run `npm test`, `npm run type-check`, `npm run lint`, and `npm run deps:check`.
- [x] 5.2 Sync the implemented spec and align development/ingestion guides with delivery. Update index links if needed. Run `npm run openspec:validate` and `npm run docs:check`.
- [x] 5.3 Remove inactive required/forbidden assertions from main fixtures. Keep main gold and research/tool conditions. Move useful matcher checks to small regression test fixtures and main-specific checks to gold scorer tests. Verify all 45 regression definitions are unchanged and run tests, type-check, lint, dependency, documentation, and OpenSpec checks.

## 6. Replace main gold with explicit evaluators

This section replaces the main gold contract and six-case counts in the completed tasks above. The current contract has five main cases and 50 cases in total.

- [x] 6.1 Move the tested fact helpers into eval runtime. Share identity, fixture, publication, and saved-Edition checks. Implement explicit Wacken, Roskilde, Sziget, Glastonbury, and Afro Nation evaluators. Remove Tomorrowland and its captured main fixture. Keep all 45 regressions.
- [x] 6.2 Replace main gold loading and dataset ground truth with evaluator source snapshots. Hash shared helpers, case rules, and expected values into the revision. Keep the four Mastra score adapters and normal apply pipeline. Remove the old scorer, gold schema, gold files, and duplicate prototype implementation.
- [x] 6.3 Test all five cases with independent model substitutes, deliberate factual errors, optional omissions, identity/preservation failures, dataset revisions, and saved Roskilde output. Align specs and guides. Run tests, type-check, lint, dependency, documentation, and OpenSpec checks.

Validation note: one full serial run passed all 829 tests. Later runs passed 828 tests and failed the all-groups storage test with Mastra `SQLITE_BUSY_SNAPSHOT`, including an isolated rerun. Storage-write failures remain outside the agreed scope. Type, lint, dependency, documentation, and OpenSpec checks passed.

## 7. Simplify eval tests

- [x] 7.1 Reuse one main result per case for scorer mutations and test fresh seeding separately. Keep all 48 Roskilde variants in compact typed tables. Use seven representative cases for the four-group integration run and retain selection checks for all 50 cases. Remove unused temporary directories. Test Mastra adapters with distinct metrics and N/A. Run the test suite, type, lint, dependency, and OpenSpec checks.

Section 7 validation: the normal full run passed all 834 tests in 71 files. Type, lint, dependency, and OpenSpec checks passed. No runtime scoring rules or storage-failure handling changed.

## 8. Remove duplicate scorer tests

This section replaces the 48-variant requirement in section 7.

- [x] 8.1 Remove duplicate shared checks and per-value cases from the Roskilde matrix. Check omissions once. Keep source-specific ticket rules, important identity and preservation failures, helper tests, one real replay, and the small Mastra integration suite. Remove assertions about the old saved score and other JSON constants. Keep all 45 regression cases. Run tests, type, lint, dependency, and OpenSpec checks.

Section 8 validation: all 792 tests in 71 files passed. Type, lint, dependency, and OpenSpec checks passed. All eval fixture files are unchanged. The three edited test files decreased from 585 to 316 lines.

## 9. Reduce dataset storage and validation

This section replaces the per-item source snapshots in section 6.

- [x] 9.1 Store main evaluator sources once in dataset metadata and hash them into the revision. Keep item ground truth limited to case expectations. Validate owned item fields and dataset metadata only; ignore unused Mastra item fields. Test source changes, stored edits, repeat imports, and unused fields. Remove repeated guide rules and run tests, type, lint, dependency, documentation, and OpenSpec checks.

Section 9 validation: the first full run passed 791 tests and failed one with Mastra `SQLITE_BUSY_SNAPSHOT`. The affected file and the experiment integration file passed in isolation. A second normal full run passed all 792 tests in 71 files. Type, lint, dependency, documentation, OpenSpec, and edited-code format checks passed. Storage failure handling is unchanged.

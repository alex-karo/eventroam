# Tasks

Implement in order. Use the [design](design.md) for decisions and the [spec](specs/operations/ingestion-evaluation/spec.md) for behavior. Paid model runs are not required.

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

## 10. Correct expectations after the main run

- [x] 10.1 Accept declared displayed or fee-inclusive base prices and the clean Wacken store URL. Allow listed additions to the selected Wacken and Sziget saved Editions while protecting other facts. Add the four observed geocoding request aliases. Keep source fixture failures and regression cases unchanged. Test the corrected alternatives and wrong values; align specs and the guide.

Section 10 validation: the focused run passed all 34 tests. Both full runs passed 798 of 799 tests and failed the same Mastra integration test with `SQLITE_BUSY_SNAPSHOT`. All four tests in that file passed in isolation. Type, lint, dependency, documentation, OpenSpec, and edited-code format checks passed. Rechecking the saved main outputs gives zero checked errors for Wacken and Sziget, each with 8/9 additional facts; Roskilde retains 11/11. Original fixture observations remain unchanged. No new model calls were made.

## 11. Accept the two active schedule statuses

- [x] 11.1 Accept announced and scheduled in main facts and saved Edition checks. Keep cancelled and postponed distinct. Add a TODO for deterministic agent status rules, test the boundary, and align specs and the guide.

Section 11 validation: all 31 tests in the three affected evaluator test files passed. Type, lint, dependency, documentation, OpenSpec, and diff checks passed. No production status rules, model calls, or saved experiment records changed.

## 12. Expand source fixtures

- [x] 12.1 Refresh Wacken, Roskilde, and Sziget through the production HTTP reader and add the URLs missing from the saved main run. Keep actual partial and failed results and per-case capture dates. Replace Glastonbury pages with the owner-requested synthetic preservation scenario and label its origin. Accept the newly captured Wacken store URL and the full Roskilde Smart Ticket cost; reject instalments and unrelated products. Keep all 45 regressions. Test replay and scoring, and align documentation and specs.

Section 12 validation: all 22 real source responses match production reader output (Sziget info removes trailing spaces only). All 11 previously missing Wacken, Roskilde, and Sziget URLs replay without fixture misses, including the real Wacken 404. The full run passed 807 of 808 tests; one Mastra integration test failed with `SQLITE_BUSY_SNAPSHOT`. The affected eval and dataset test files passed all 50 tests in isolation. Type, lint, dependency, documentation, OpenSpec, and diff checks passed. All 45 regression definitions are unchanged. No new model calls or saved experiment edits were made.

## 13. Correct fixtures and false failures

- [x] 13.1 Add twelve observed real source URLs with actual reader outcomes and the observed Roskilde and Budapest locality queries. Remove Openair completeness units for Wacken and Sziget. Accept source-backed genre alternatives, declared locality points for the three fill cases, their supported Festival/Music additions and publication of eligible saved Editions, and both Smart Ticket amounts. Keep wrong values and existing points protected. Remove dated past evidence from synthetic Glastonbury pages, retain country-level festival identity, and add its requested info and Instagram pages. Keep all 45 regression cases.
- [x] 13.2 Run tests and static checks, then run all five main cases with the same model for all three agents. Inspect remaining failures without changing saved results.

Section 13 validation: all 818 tests in 71 files passed. After the final sort comparator change, all 40 affected evaluator tests passed. Type, lint, dependency, documentation, OpenSpec, format, and diff checks passed. All 45 regression definitions remain unchanged. Control experiment `b04e1207-776d-4f31-88d6-26827c7f4059` ran all five main cases with `openai/gpt-6-luna` for all three agents. Two cases passed. Wacken and Roskilde have full required facts and zero checked errors but new fixture misses (five source URLs and one Roskilde query across both cases). Sziget has full completeness but adds an unsupported administrative area to its protected saved Edition. Wacken also omits its additional YouTube link. Glastonbury and the expected blocked Afro Nation case pass. Saved experiment records are unchanged.

## 14. Reduce main-only failure conditions

This section replaces the main fixture-miss failure rule and strict equality for empty optional saved fields in earlier sections. Regression checks stay unchanged.

- [x] 14.1 Keep main source and geocoding fixture misses as diagnostics only. Permit additions to empty optional saved fields without declared expectations, without completeness credit. Protect populated saved data, required fields, identities, publication, and declared coordinate rules. Test these boundaries and align specs and the guide.
- [x] 14.2 Run tests and static checks, then run all five main cases with the same model for all three agents. Inspect remaining failures without changing saved results.

Section 14 validation: all 66 focused tests passed. The first full run passed 817 of 819 tests; two Mastra storage integration tests failed with the known SQLITE_BUSY_SNAPSHOT error. Both affected files passed in isolation (52 tests). A full sequential run passed all 819 tests in 71 files. Type, lint, dependency, documentation, OpenSpec, format, and diff checks passed. All 45 regression definitions are unchanged. Fresh experiment `e40f9660-095d-4bbd-b06a-e48df6e4e75c` used `openai/gpt-6-luna` for all three agents and passed four of five main cases. All three fill cases have 5/5 required facts. Wacken passes with 7/8 additional facts (missing YouTube); Sziget passes with 8/8, a diagnostic missing press page, and a new administrative area on its saved Edition. Glastonbury and the expected blocked Afro Nation case pass. Roskilde has 10/11 additional facts and one narrow address expectation: the output adds the supported venue name and country to Darupvej 19, 4000 Roskilde. Its two geocoding fixture misses are retained as diagnostics. No source fixtures or saved experiment results were changed during this section.

Address follow-up: Roskilde now accepts `Festivalpladsen, Darupvej 19, 4000 Roskilde, Denmark`. Rechecking its saved output from experiment `e40f9660-095d-4bbd-b06a-e48df6e4e75c` gives 5/5 required facts, 11/11 additional facts, zero checked errors, and success. The two diagnostic geocoding fixture misses remain. The original stored experiment is unchanged; no model calls were made. All 41 tests in the two affected evaluator test files passed.

## 15. Restore realistic Glastonbury page structure

- [x] 15.1 Adapt real Glastonbury reader output with navigation, unrelated news, information sections, and page controls. Remove programme confirmation from text, links, and metadata. Keep archive years as navigation only, the current seed, and preservation checks. Record the edits in provenance, test fixed-source replay, and run checks without model calls.

Section 15 validation: ten adapted pages retain the real reader structure, with 13 fixed responses including the observed tickets-path redirect, the Info Tickets anchor and the production Instagram stub. The test model output now removes duplicate final URLs and excludes unreadable sources. The full sequential run passed all 822 tests in 71 files. Type, lint, documentation, OpenSpec, edited-code format and diff checks passed. The seed, input and expectations are unchanged; all 45 regression case definitions are unchanged. The focused run encountered the known Mastra SQLITE_BUSY_SNAPSHOT error before the successful full run. No model calls or saved experiment edits were made.

## 16. Identify development experiments

- [x] 16.1 Name experiments with the current branch, group, model and optional `--label`. Use a short commit for detached HEAD. Save the full commit, branch, dirty flag and label in experiment metadata without changing dataset identity. Test CLI parsing, saved names, dataset reuse and detached HEAD with model substitutes. Update the guide and specs, and run checks without model calls.

Section 16 validation: all 182 eval tests in 16 files passed with model substitutes. Saved names and Git metadata survive reopening storage; branch, commit, dirty state and label changes reuse the dataset. Detached HEAD, the separate Location model and CLI label errors are covered. Type, lint, dependency, documentation, OpenSpec, format and diff checks passed. No live model calls or existing experiment edits were made.

## 17. Use a coarse file hash for dataset identity

This section replaces resolved-content hashing, saved source snapshots and stored-item validation in earlier tasks.

- [x] 17.1 Hash all case JSON/MD files and main evaluator/helper source files. Add group, selected case IDs, repeat count and scorer version to dataset identity. Reuse existing datasets without reading or comparing saved items; remove source snapshots and obsolete verification tests. Keep version pinning, small hash/import tests and model-substitute integration coverage. Update specs and guides, and run checks without model calls.

Section 17 validation: all 182 eval tests in 16 files passed; after type and lint fixes, all nine dataset/runner integration tests passed again. Hash tests cover file names, whitespace, fixtures, main rules and selection settings. Native imports reuse item IDs without reading stored items, accept manual Studio edits and pin the current version. Type, lint, dependency, documentation, OpenSpec, format and diff checks passed. The dataset module and the two affected test files decreased from 804 to 667 lines. No live model calls or existing experiment edits were made.

## 18. Remove eval tests only

This section replaces earlier requirements to keep eval unit tests, model-substitute runs, and persistence smoke tests. All 50 eval cases, fixtures, scorers, selection flags, and runtime behavior stay unchanged.

- [x] 18.1 Remove tests under `src/ingestion/evals/` and unused `src/test/eval-*` helpers. Keep all five main and 45 regression cases and their runners.
- [x] 18.2 Align test guidance and run the remaining tests, type, lint, dependency, formatting, documentation, and OpenSpec checks without model calls.

## 19. Use simple regression checks

- [x] 19.1 Replace regression intermediate scores and duplicate diagnostics with shared `Check[]` and one scenario result. Keep all 45 JSON expectations, pipeline mutation matching, partial matching, Location rules, and expected failures. Reuse Research and tool checks in main. Update CLI and the existing Mastra adapter without adding eval tests.
- [x] 19.2 Align the spec and guide, increase the scorer version, and run application tests and static checks without model calls. Check saved outputs where available.

Section 19 validation: all 692 application tests in 64 files passed with coverage. Type, lint, dependency, format, documentation, OpenSpec, and diff checks passed. The suite still loads five main and 45 regression cases; all case JSON files are unchanged. A temporary replay compared the previous and current predicates using 31 saved v7 workflow reports against all 32 pipeline/editor regression expectation sets. All 992 decisions and failed-check counts matched. This checks saved material, not new model execution of all regression cases. No eval tests, model calls, or saved experiment changes were added. Scorer version is 3.

## 20. Remove eval test options and run the full suite

- [x] 20.1 Remove unused eval test substitutions, test parameters, and duplicate validation. Exclude eval code and its CLI from application coverage. Update current documentation without changing case expectations.
- [x] 20.2 Run application tests and static checks, then run all 50 eval cases once with the configured models. Retain experiments and inspect failures without changing saved results or weakening expectations.

Section 20 validation: all 692 application tests passed. Type, lint, dependency, format, documentation, OpenSpec, and diff checks passed; coverage contains no eval code or eval CLI. One full run used `openai/gpt-6-luna`, medium reasoning, and Flex for all three agents: main 3/5, pipeline regression 21/25, editor regression 7/7, Location regression 9/13. All 50 results and traces were saved in this worktree. Four failures were provider-unavailable errors (502); three were strict regression geocoding fixture misses. Wacken rejected an added `metal` term in the saved 2026 Edition because its expected classification is too narrow. Glastonbury created an extra 2025 Edition from archive navigation; `search-wrong-official` made three searches against a one-search limit. No case expectations or saved results were changed.

Experiments: main `c711a572-d725-4a0e-9b7f-7dd7323796ff`; pipeline `ed25788d-03f2-4b7e-9049-f7e6f5298732`; editor `d12f10b8-02c6-47fe-8ea4-657517413af6`; Location `cb6c4e6c-3ad7-43be-bb29-a8bc6e8a31ce`.

## 21. Put Research checks in each case

- [x] 21.1 Move Research conditions from JSON expectations and the shared interpreter to explicit case functions. Keep check meanings, all 50 cases, workflow mutations, and Location rules. Share small data helpers and repeated refusal checks. Hash the new case functions and helpers into dataset identity. Update the guide and spec.
- [x] 21.2 Compare previous and new Research checks on saved workflow reports without changing experiments. Run application tests and static, documentation, and OpenSpec checks. Add no eval unit tests or model calls.

Section 21 validation: all 692 application tests in 64 files passed. Type, lint, dependency, formatting, documentation, OpenSpec, and diff checks passed. All 50 case files retain their inputs and other expectations; only Research expectations moved to TypeScript. Comparing 68 saved workflow reports against all 37 workflow cases gives 2,516 equal check sets and pass/fail decisions. Research conditions also match in all 36 saved main outputs replayed through the main evaluator. These checks used temporary scripts, without new eval tests, model calls, or saved experiment changes. Dataset identity includes the new case functions, registry and shared helpers; scorer version is 4.

## 22. Accept supported Glastonbury history

- [x] 22.1 Allow no new Edition or one draft 2025 Edition with country GB and unknown dates, supported by archive navigation. Keep saved 2027 data and draft publication protected. Align provenance, the guide, design and specs; remove the archive known issue. Replay saved results and check invalid alternatives without model calls or new eval tests.

Section 22 validation: the saved Flex and Standard failures now pass with 4/4 additional facts and zero checked errors. The earlier passing result with no new Edition still passes. Eight temporary negative checks reject another year, another country, invented dates, an extra Edition, Event publication, historical publication, changed saved dates and saved Edition publication. Type, affected-code lint and formatting, documentation, OpenSpec and diff checks passed. No model calls, new eval tests or saved experiment edits were made. The changed evaluator and provenance are covered by the automatic dataset hash.

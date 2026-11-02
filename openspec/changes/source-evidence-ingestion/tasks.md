# Tasks

## 1. Assignments and agent contracts

- [x] 1.1 Build concrete assignments for add, full and current. Verify source permissions, target restrictions and General's supplied catalog candidates.
- [x] 1.2 Define the fixed role contracts in [the design](design.md#contracts). Verify field ownership, supplied evidence and point references, and rejection of removed reference fields or Editor replacement values.
- [x] 1.3 Keep technical status, safe errors and skip reasons in host records. Verify domain rejection, unfinished checks, skipped calls and invalid required output. Document role boundaries in `docs/ingestion-process.md`.

## 2. Saved sources and Reader

- [x] 2.1 Save private Markdown, provenance and evidence files for each source. Verify exact recovery, stable artifact roots and failure before dependent work. Document storage and explicit cleanup in `docs/ingestion-tools.md` and `docs/infrastructure.md`.
- [x] 2.2 Run Reader once per admitted full page. Verify distant year and table context. Above the input bound, save the whole page and report it as unprocessed without a prefix fallback.
- [x] 2.3 Bind literal quotations and context to immutable source text. Verify repeated passages, invalid context, Unicode offsets and one passage supporting several facts. Preserve other valid evidence after a binding failure.
- [x] 2.4 Return compact `inspectPage` results and source-linked URL leads. Verify concurrent cache reuse, requested/final URL matching and unread leads. Document the boundary in `docs/source-reader.md`.
- [x] 2.5 Bound Reader calls and parallel tools, reserve downstream time and freeze the corpus after admitted work settles. Verify cancellation, shared limits, retained partial sources and no writes after freeze.

## 3. Common facts and field specialists

This group depends on assignments and a validated frozen corpus.

- [x] 3.1 Restrict Research to navigation and assigned check accounting. Verify host-owned source lists, valid references, known-link preference, discovery restrictions and useful partial collection. Identity clues must not skip remaining checks.
- [x] 3.2 Use General for identity, Edition selection and common facts. Verify confirmed duplicate exit, uncertain identity, stable keys, temporal selection, scope restrictions and private name-mismatch metadata.
- [x] 3.3 Use Tickets only for `currentOrNextEdition`, including an ongoing Edition. Verify complete observed offers without URLs, supported free admission, unknown prices and preservation without an accepted replacement.
- [x] 3.4 Use Classification with complete lists and supplied vocabulary. Verify retained terms, supported reuse from an eligible preceding Edition, ancestor normalization and facet limits.
- [x] 3.5 Run Links independently after General. Verify Event links, ticket overview preference, unread checkout, query preservation and historical-link preservation. The [Roskilde issue](../../../docs/archive/known-issues/2026-10-27-roskilde-edition-ticket-link.md) records the passing repeated link checks.
- [x] 3.6 Run Location before Editor with selected targets and source support. Verify `previousPoint` and `reusePrevious` binding, ambiguous or absent earlier points, shared geocoding limits and place preservation. Document the order in `docs/ingestion-process.md`; isolated Location regressions pass in the recorded full runs.

## 4. Proposal review and catalog preparation

This group depends on all assigned specialist contracts.

- [x] 4.1 Assemble fixed proposal groups with their saved values, support and versions in `src/ingestion/proposals.ts`. Verify point and classification reuse, independent ticket/link groups and results independent of branch completion order.
- [x] 4.2 Restrict Editor to fixed approve/reject decisions. Verify complete review keys, cited-source access through native Mastra grep, source hashes and rejection of unsupported meaning despite a literal match.
- [x] 4.3 Apply review and temporal prerequisites before operation preparation. Verify no reassignment, preservation of rejected optional groups and publication evaluation for supported targets.
- [x] 4.4 Prepare operations from accepted proposals in `src/ingestion/catalog-plan.ts`. Verify ownership, country and version guards, preview rollback and atomic failure. Document the review and failure flow.

## 5. Workflow and report consumers

- [x] 5.1 Remove the old broad fixture contracts, combined result converters and `generateCandidate`/`generateEditor` injection fields. Use direct current role responses in workflow and provider tests. Verify no old entry points or schemas remain. Keep coverage of the fixed parallel flow, duplicate exit and failure join.
- [x] 5.2 Build reports from host execution records, validated results and saved sources. Verify partial collection, identity and Location refusals, actual final responses, duplicate counts and retained diagnostics without a report-version change.
- [x] 5.3 Save source references and available step results for inspection after exit. Verify cancelled and failed collection, inspection without credentials and workflow-history deletion that preserves source files. Update the tools and structure docs.
- [x] 5.4 Remove `CATALOG_CAPTURE_TOOL_OUTPUTS` and its writer, plumbing and tests. Verify required source storage without the flag. Document the loss of ordered tool-response dumps while retaining eval recording.

## 6. Evaluation contracts

- [x] 6.1 Adapt workflow, fixed Editor and isolated Location fixtures to the owning roles. All 50 current cases load with reference checks; Editor handoffs use schema version 5. Recorded full runs pass all Editor and isolated Location cases. Verify no live fallback, no evaluator input to models and no technical failure accepted as a domain refusal.
- [x] 6.2 Replace historical ticket expectations with preservation checks. Verify amount/currency checks without offer URLs, ongoing Editions and the Edition ticket overview. Document the revised boundary in `docs/ingestion-evals.md`.
- [x] 6.3 Apply explicit eval model selection to every executed role. Verify Location overrides, skipped roles and recorded prompt/model versions. Inspect usage through observability.
- [x] 6.4 Move regression conditions from JSON to registered TypeScript checks. Verify saved-output scoring, mutation and tool-use conditions, refusal checks and dataset hashing. Keep original experiment results unchanged.

## 7. Integrated validation

- [x] 7.1 Run affected tests, type checking, lint, dependency checks, formatting, `pnpm run openspec:validate` and `pnpm run docs:check`. Verify shared CLI/Studio reports. After removal of the old fixture contracts, 731 unit tests pass. The evaluation fixtures retain 50 valid case loads.
- [ ] 7.2 Validate model quality for the final contracts and prompts on the affected fixtures. Inspect recall, final quality and source reads. The final-contract focused check passes both Roskilde and search-date-conflict twice on standard tier; it does not replace full-suite validation. The owner accepts the current inference cost; no further cost comparison or reduction is required.
- [ ] 7.3 Review the selected Reader input/output bounds, call allowance and downstream reserve against those measurements. Record accepted settings and remaining quality risks. Further cost tuning is not required. Repeat only checks affected by further tuning.
- [ ] 7.4 Sync the remaining changed requirements into their owning main specs after verification. Some follow-up rules are already synced and need no duplicate delta. Check proposal/spec agreement, affected links, `pnpm run openspec:validate` and `pnpm run docs:check`. Update the documentation index if the document set changes.

## Validation evidence and limits

The [eval comparison](../../../docs/proposals/source-evidence-eval-comparison.md) retains earlier measurements. Completed work covers page coverage, native grep, compact role inputs, Research blockers, free and unsupported ticket categories, Event identity, geocoding replay, schedule status, quotation corrections and model text length guidance. These are completed work, not separate pending task groups.

The earlier full comparison passes 48/50 cases. Main retains 10/15 required facts and 19/33 additional facts after Roskilde's Editor failure. The two affected repeats then pass with unchanged checks. Neither run measures the later Research text-blocker and text-length contracts. Passing unit tests does not establish final model quality. The owner accepts the current cost and has removed further cost optimization and controlled cost comparison from the remaining work.

The proposed mixed-ticket-block Editor case and extra geocoding decoy discrimination remain optional coverage decisions. They are not implemented guarantees. Existing Editor inputs are fixed; the old variable-fixture problem no longer blocks 3.5, 3.6 or 6.1. Keep remaining model-quality work in 7.2 rather than reopening completed specialist implementation.

The final-contract affected repeats (`problem-repeats-final`) pass 4/4 on standard tier. Roskilde retains 10/10 required and 21/22 additional facts, with base price omitted once. Both date-conflict attempts pass.


## 8. Isolated Reader evaluation

- [x] 8.1 Add the `regression/reader` group with three existing pages, code-defined passage and topic requirements, literal binding, metadata checks and extraction-volume diagnostics. Retain default main selection and include Reader in `--all`. Keep expectations out of model inputs and use no model judge.
- [x] 8.2 Run the three cases once on standard tier with the current production Reader, inspect saved results and record errors without weakening requirements. Verify types, affected lint, dependency boundaries, documentation and OpenSpec.
- [x] 8.3 Use trace research to correct excessive Reader expectations and improve local year context and link selection. Keep Luna, unique literal binding, complete prices and conditions, and one coherent item per requirement. Treat discarded extra quotes as diagnostics when all required evidence survives; retain production limitations. Verify all three Reader cases with repeated standard-tier calls.
- [x] 8.4 Check the changed Reader against the full eval suite on standard tier and inspect failures. Run affected application checks and align the evaluation guide and specs with the final behavior.
- [x] 8.5 Correct downstream failures found by the full run: unsupported saved temporal targets, omitted programme topics beside music genres, lost country details in navigation coverage, local-day selection, and unsupported saved-point replacement. Correct excessive optional-term and unpriced-offer checks; make historical realization explicit in the synthetic size fixture. Keep source and publication guards. Inspect the full-suite result on Luna and standard tier, then repeat cases affected by the final prompt changes. Keep those measurements separate.
- [x] 8.6 Verify medium Reader reasoning and conservative source binding. Accept full literal opening/suffix forms and restore extra wire escapes only after an exact unique source match. Keep changed facts, ambiguous text, reversed ranges, partial overlaps and oversized quotes invalid. Run the repeated Reader cases and the complete suite, then repeat cases affected by later settings or prompt changes. Record the loaded versions and keep original results unchanged.

The first isolated Reader run has 0/3 passing scenarios despite valid model output in all three attempts. Source review confirms topic, context and quotation-binding failures. One narrow Sziget identity expectation was corrected and the saved output rescored; the scenario still fails. The original native experiment remains unchanged. These eval failures remain visible and do not block completion of the requested eval setup.

The follow-up uses production recipient routing and complete factual alternatives. Reader v23 retains 75/75 declared requirements across nine standard-tier attempts, with 9/9 passing scenarios and 86/87 literal bindings. The rejected extra link remains a visible diagnostic; processing-status rules stay unchanged. The original v20 outputs score 2/3 under the final checks and still expose Sziget's missing local year context. Usable required evidence does not imply complete processing.


The final Reader v33 sample passes 9/9 with 75/75 declared requirements. An independent check confirms 75 accepted quotes and eight contexts as exact unique source spans. The latest complete run loads Reader v31 and Editor v24 and passes 52/53, with main 5/5 and 15/15 required plus 31/33 additional facts. Its only failure is a false Editor rejection of a saved Student category absent from the proposal. Editor v25 then passes both affected checkout cases twice (4/4), and all seven fixed Editor cases pass. These focused repeats do not constitute a new 53/53 full run. All 749 application tests pass; the final affected 48 tests, type checking, lint, formatting, dependency checks, documentation checks and OpenSpec validation also pass. Luna stays in use. Reader and General use medium; Tickets remains low after the rejected medium experiment.

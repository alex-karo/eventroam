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
- [x] 3.5 Run Links independently after General. Verify Event links, ticket overview preference, unread checkout, query preservation and historical-link preservation. The [Roskilde issue](../../../../docs/archive/known-issues/2026-10-27-roskilde-edition-ticket-link.md) records the passing repeated link checks.
- [x] 3.6 Run Location before Editor with selected targets and source support. Verify `previousPoint` and `reusePrevious` binding, ambiguous or absent earlier points, shared geocoding limits and place preservation. Document the order in `docs/ingestion-process.md`.

## 4. Proposal review and catalog preparation

This group depends on all assigned specialist contracts.

- [x] 4.1 Assemble fixed proposal groups with their saved values, support and versions in `src/ingestion/proposals.ts`. Verify point and classification reuse, independent ticket/link groups and results independent of branch completion order.
- [x] 4.2 Restrict Editor to fixed approve/reject decisions. Verify complete review keys, current-run source access through native Mastra grep, source hashes and rejection of unsupported meaning despite a literal match.
- [x] 4.3 Apply review and temporal prerequisites before operation preparation. Verify no reassignment, preservation of rejected optional groups and publication evaluation for supported targets.
- [x] 4.4 Prepare operations from accepted proposals in `src/ingestion/catalog-plan.ts`. Verify ownership, country and version guards, preview rollback and atomic failure. Document the review and failure flow.

## 5. Workflow and report consumers

- [x] 5.1 Remove the old broad fixture contracts, combined result converters and `generateCandidate`/`generateEditor` injection fields. Use direct current role responses in workflow and provider tests. Verify no old entry points or schemas remain. Keep coverage of the fixed parallel flow, duplicate exit and failure join.
- [x] 5.2 Build reports from host execution records, validated results and saved sources. Verify partial collection, identity and Location refusals, actual final responses, duplicate counts and retained diagnostics without a report-version change.
- [x] 5.3 Save source references and available step results for inspection after exit. Verify cancelled and failed collection, inspection without credentials and workflow-history deletion that preserves source files. Update the tools and structure docs.
- [x] 5.4 Remove `CATALOG_CAPTURE_TOOL_OUTPUTS` and its writer, plumbing and tests. Verify required source storage without the flag. Document the loss of ordered tool-response dumps while retaining eval recording.

## 6. Evaluation contracts

- [x] 6.1 Adapt workflow, fixed Editor and isolated Location fixtures to the owning roles. Validate case loading and reference checks; Editor handoffs use schema version 5. Verify no live fallback, no evaluator input to models and no technical failure accepted as a domain refusal.
- [x] 6.2 Replace historical ticket expectations with preservation checks. Verify amount/currency checks without offer URLs, ongoing Editions and the Edition ticket overview. Document the revised boundary in `docs/ingestion-evals.md`.
- [x] 6.3 Apply explicit eval model selection to every executed role. Verify Location overrides, skipped roles and recorded prompt/model versions. Inspect usage through observability.
- [x] 6.4 Move regression conditions from JSON to registered TypeScript checks. Verify saved-output scoring, mutation and tool-use conditions, refusal checks and dataset hashing. Keep original experiment results unchanged.

## 7. Integrated validation

- [x] 7.1 Run affected tests, type checking, lint, dependency checks, formatting, `pnpm run openspec:validate` and `pnpm run docs:check`. Verify shared CLI/Studio reports.
- [x] 7.2 Run each eval group on standard tier and inspect recall, final quality, source reads and native usage. Keep failures visible in the saved experiments. Track the remaining quality work separately below. No further cost comparison or reduction is required.
- [x] 7.3 Review Reader input/output bounds, call allowance and downstream reserve. Retain the current settings: 288,000 usable page characters, 12,000 Reader output tokens, 18 calls and up to 180 seconds downstream reserve. No observed failure needs a limit change. Near-limit live pages remain untested.
- [x] 7.4 Sync all eight delta specs into their owning main specs. Preserve unrelated requirements and scenarios. Remove obsolete source-prefix and optional-capture rules. Check proposal/spec agreement, affected links, `pnpm run openspec:validate` and `pnpm run docs:check`.

## 8. Isolated Reader evaluation

- [x] 8.1 Add the `regression/reader` group with three existing pages, code-defined passage and topic requirements, literal binding, metadata checks and extraction-volume diagnostics. Retain default main selection and include Reader in `--all`. Keep expectations out of model inputs and use no model judge.
- [x] 8.2 Run the three cases once on standard tier with the current production Reader, inspect saved results and record errors without weakening requirements. Verify types, affected lint, dependency boundaries, documentation and OpenSpec.
- [x] 8.3 Use trace research to correct excessive Reader expectations and improve local year context and link selection. Keep Luna, unique literal binding, complete prices and conditions, and one coherent item per requirement. Treat discarded extra quotes as diagnostics when all required evidence survives; retain production limitations. Verify all three Reader cases with repeated standard-tier calls.
- [x] 8.4 Check the changed Reader against the full eval suite on standard tier and inspect failures. Run affected application checks and align the evaluation guide and specs with the final behavior.
- [x] 8.5 Correct downstream failures found by the full run: unsupported saved temporal targets, omitted programme topics beside music genres, lost country details in navigation coverage, local-day selection, and unsupported saved-point replacement. Correct excessive optional-term and unpriced-offer checks; make historical realization explicit in the synthetic size fixture. Keep source and publication guards. Inspect the full-suite result on Luna and standard tier, then repeat cases affected by the final prompt changes. Keep those measurements separate.
- [x] 8.6 Verify medium Reader reasoning and conservative source binding. Accept full literal opening/suffix forms and restore extra wire escapes only after an exact unique source match. Keep changed facts, ambiguous text, reversed ranges, partial overlaps and oversized quotes invalid. Run the repeated Reader cases and the complete suite, then repeat cases affected by later settings or prompt changes. Record the loaded versions and keep original results unchanged.

## 9. Source validation and place discovery follow-up

- [x] 9.1 Give Editor native grep access to all saved Markdown pages of the current run, with URLs and available overviews. Preserve exact path, read-only and hash checks. Verify uncited and unprocessed pages, failed fetches and rejected paths.
- [x] 9.2 Let Research seek a concrete festival place when country is known. Keep known-lead preference, explicit nonpublication stops, the shared budget and existing publication minimum. Update existing requirements without adding a requirement.
- [x] 9.3 Run affected application checks and main, Editor, search-policy and Reader evals on standard tier. Inspect new source-access and place-discovery cases and record actual results.

## 10. Remaining quality findings

- [x] 10.1 Investigate the rejected ticket quotation in `source-known-offers-blocked-checkout`. Preserve exact source binding; fix the cause and repeat the affected check.
- [x] 10.2 Resolve the mixed-format evidence ambiguity in `narrow-current-changed` and the Links role's out-of-scope Event-link gap. Keep the substantial-main-programme rule and current-scope boundary.
- [x] 10.3 Resolve the full-refresh guidance check in `current-identity-contradiction`. Preserve the safe refusal, no-write and no-search conditions.

## 11. Prompt experiments and trace review

- [x] 11.1 Run main and isolated Reader baseline evals twice per case through OpenCode Go and retain native results.
- [x] 11.2 Prefer full literal quotations for short blocks in Reader and advance its prompt version. Pass existing evidence tests and focused static checks. Keep this guidance in design rather than specs.
- [x] 11.3 Repeat the same eval selection twice per case and compare completeness, literal binding, tokens and available cost in chat.
- [x] 11.4 Add fictional examples to Reader, Links, Tickets and Location; advance their prompt versions and pass focused tests and static checks.
- [x] 11.5 Run main and isolated Reader evals twice per case through OpenCode Go on the unchanged dataset; compare quality, trace failures, tokens and estimated cost with the short-quotation baseline in chat.
- [x] 11.6 Shorten Reader and Tickets examples, add the Classification consistency example, clarify Reader context and Editor file selection, and advance affected prompt versions.
- [x] 11.7 Accept the supported Roskilde address form and add a declared synthetic discovery response for the existing Sziget Travel capture; pass focused checks.
- [ ] 11.8 Run main, isolated Reader and affected format/Editor cases twice through OpenRouter standard; inspect failures, additional facts, effective settings and native cost in chat.

## 12. Source artifact inspection

- [x] 12.1 Prefix new source folders with the saved run start time and existing run ID. Verify ordering, same-time runs, shared evidence paths and original provenance IDs. Pass 93 focused source, Editor and workflow tests plus type, lint, format, documentation and OpenSpec checks. Document the path in the design and ingestion tools guide.

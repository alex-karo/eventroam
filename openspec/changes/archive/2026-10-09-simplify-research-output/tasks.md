# Tasks

Acceptance cases are in the [delta spec](specs/catalog/source-workflow/spec.md); contract and mappings are in [design.md](design.md).

## 1. Research contract and prompt

- [x] 1.1 Implement the strict schema in `research/contracts.ts`; test envelope consistency, typed/grouped facts, ticket variants, social slots, source uniqueness, required reasons, and rejection of malformed/legacy fields against the delta scenarios.
- [x] 1.2 Update `research/agent.ts` prompt/version for create-only add, provider schema, and normalization; test preserved data/value/basePrice nulls, optional-null omission, invalid component nulls, and intermediate tool commentary.
- [x] 1.3 Update contract/examples in `docs/ingestion-process.md`; verify schema agreement and `npm run docs:check`.

## 2. Preparation and attribution

- [x] 2.1 Adapt `research/prepare.ts` ownership and grouped-field mappings. Test failure/target isolation, creation-only identity reasons, omission/clearing, preserved zones, complete tickets, term removal precedence, and owner/kind link replacement. Test omitted slots, removal of multiple old URLs only in the supplied slot, equivalent-URL no-ops, cross-owner inheritance, and atomic failure preservation. Test add with an existing ID and changed tickets/summary/links/editions returns skipped/ID with zero operations, including publication; retain targeted refresh/check updates. Verify differing eventName never renames or changes aliases/slug.
- [x] 2.2 Map explanations to actual `report.ts` changes separately from writes. Test identity/summary, year/status, explicit cancellation, clearing, grouped-field expansion, taxonomy aggregation, temporary IDs, and no-op audit behavior. Verify host eventNameMismatch captures both original names/ID after trimmed comparison and survives skip/dry-run/no-op/write failure without status changes.
- [x] 2.3 Update preservation/attribution guidance in `docs/project-structure.md` and `docs/ingestion-process.md`; verify `npm run docs:check` and agreement with slot-replacement semantics.
- [x] 2.4 Add catalog kind/label `x` and socials mapping. Test both account domains, write/read/inheritance, preservation of omitted link slots, and rejection of twitter alias.

- [x] 2.5 Normalize all model money to major units with validated three-letter currency codes and convert base prices at the adapter boundary, including saved model context. Test EUR/JPY/KWD, decimal precision, ranges/free/unknown prices, overflow, invalid currencies, and rejection of model minor-unit fields; document units in ingestion guidance.
- [x] 2.6 Remove aggregate availability from public detail/discovery contracts and all map/list/detail indicators; expose category label/availability on eligible public details. Test mixed category states, unknown states, stale stored aggregate values, unchanged schedule/price/filter behavior, and private metadata exclusion. Verify the affected views with the built-in Browser and update public behavior docs.

## 3. Reports, CLI, and evals

- [x] 3.1 Replace workflow gaps with researchStatus, staged errors, questions, and sourceSummaries. Test recovery, provider/limit/schema failures, optional unknowns, partial no-ops, dry runs, and rollback retaining status/raw output/summaries.
- [x] 3.2 Update CLI text/JSON to v2; test both statuses, explained diffs, summary/history separation, informational name-mismatch logs/JSON, partial/skipped-zero and failure-nonzero exits, multiple targets, and sanitized diagnostics.
- [x] 3.3 Update eval producers, fixtures, and scorer to v2; remove the v1 gaps fallback; test explicit rejection of unsupported report versions, partial factual assertions, and failed-research scoring without citations.
- [x] 3.4 Update report/eval guidance in `docs/development.md` and `docs/ingestion-process.md`, including private attribution and the new-format-only contract; verify `npm run docs:check`.

## 4. Integration and completion

- [x] 4.1 Run `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test`; all must pass.
- [x] 4.2 Run captured-page catalog evals; inspect statuses, reasons, source-summary accuracy, grouped facts, per-category availability, and link ownership against required/forbidden assertions. Record provider/credential limitations instead of claiming unrun checks passed.
- [x] 4.3 After implementation, sync all deltas into their owning main specs and update index/lifecycle documentation; verify `npm run openspec:validate` and `npm run docs:check`.

## 5. Default Flex follow-up

- [x] 5.1 Default shared eval/research/discovery configuration to Flex, support explicit standard routing, update environment/docs and main spec, and verify configuration plus provider request tests, type-check, lint, formatting, OpenSpec, and docs checks.

## 6. Model failure diagnostics follow-up

- [x] 6.1 Add safe host-only structured model-failure details to text/JSON/eval reports, with nested-error and provider integration coverage; keep retries disabled and limits authoritative. Sync the owning spec and documentation, run checks, then rerun and inspect the full captured-page eval.

## 7. Research completion semantics

- [x] 7.1 Clarify prompt and status/question descriptions: incomplete announcements can succeed; partial names a specific unfinished core check and cause. Preserve omission and host validation, bump prompt version, sync docs/specs, and run relevant checks.

## 8. Base-price concessions

- [x] 8.1 Exclude eligibility-based concession tickets from basePrice while preserving them in variants; keep prompt version v5 and other price policies unchanged. Update field guidance/docs/specs and run relevant checks.

## 9. Failed-research eval

- [x] 9.1 Add a blocked-source Afro Nation eval expecting a valid failed response with null data, source diagnostics, and no mutations. Reject empty partial/success and provider/validation failures; test the scorer and run the new model case without changing the prompt.

## 10. Empty research failure

- [x] 10.1 Clarify prompt/field guidance that repeated input is not a refresh/check finding; preserve verified no-op and duplicate-add semantics. Keep v5, sync docs/specs, and run the blocked case plus full eval suite without weakening assertions.

## 11. Review regressions

- [x] 11.1 Guard URL parsing in schema refinements; test malformed source/X URLs return invalid_candidate with raw response and source history retained, no writes, and valid duplicate detection preserved.
- [x] 11.2 Collect returned usage before classifying provider failure; test a completed step followed by HTTP 503 retains known tokens/cost without retry. Remove unused modelFailed.
- [x] 11.3 Migrate Tomorrowland's forbidden sold-out assertion to price_details variants and prove a cross-festival availability mutation fails scoring. Run checks and sync regression scenarios/docs without changing equivalent-link officiality.

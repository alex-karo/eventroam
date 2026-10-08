# Tasks

Acceptance cases are in the [delta spec](specs/catalog/source-workflow/spec.md); contract and mappings are in [design.md](design.md).

## 1. Research contract and prompt

- [ ] 1.1 Implement the strict schema in `research/contracts.ts`; test envelope consistency, typed/grouped facts, ticket variants, social slots, source uniqueness, required reasons, and rejection of malformed/legacy fields against the delta scenarios.
- [ ] 1.2 Update `research/agent.ts` prompt/version for create-only add, provider schema, and normalization; test preserved data/value/basePrice nulls, optional-null omission, invalid component nulls, and intermediate tool commentary.
- [ ] 1.3 Update contract/examples in `docs/ingestion-process.md`; verify schema agreement and `npm run docs:check`.

## 2. Preparation and attribution

- [ ] 2.1 Adapt `research/prepare.ts` ownership and grouped-field mappings. Test failure/target isolation, creation-only identity reasons, omission/clearing, preserved zones, complete tickets, term removal precedence, and owner/kind link replacement. Test omitted slots, removal of multiple old URLs only in the supplied slot, equivalent-URL no-ops, cross-owner inheritance, and atomic failure preservation. Test add with an existing ID and changed tickets/summary/links/editions returns skipped/ID with zero operations, including publication; retain targeted refresh/check updates. Verify differing eventName never renames or changes aliases/slug.
- [ ] 2.2 Map explanations to actual `report.ts` changes separately from writes. Test identity/summary, year/status, explicit cancellation, clearing, grouped-field expansion, taxonomy aggregation, temporary IDs, and no-op audit behavior. Verify host eventNameMismatch captures both original names/ID after trimmed comparison and survives skip/dry-run/no-op/write failure without status changes.
- [ ] 2.3 Update preservation/attribution guidance in `docs/project-structure.md` and `docs/ingestion-process.md`; verify `npm run docs:check` and agreement with slot-replacement semantics.
- [ ] 2.4 Add catalog kind/label `x` and socials mapping. Test both account domains, write/read/inheritance, preservation of omitted link slots, and rejection of twitter alias.

- [ ] 2.5 Normalize all model money to major units with validated three-letter currency codes and convert base prices at the adapter boundary, including saved model context. Test EUR/JPY/KWD, decimal precision, ranges/free/unknown prices, overflow, invalid currencies, and rejection of model minor-unit fields; document units in ingestion guidance.
- [ ] 2.6 Remove aggregate availability from public detail/discovery contracts and all map/list/detail indicators; expose category label/availability on eligible public details. Test mixed category states, unknown states, stale stored aggregate values, unchanged schedule/price/filter behavior, and private metadata exclusion. Verify the affected views with the built-in Browser and update public behavior docs.

## 3. Reports, CLI, and evals

- [ ] 3.1 Replace workflow gaps with researchStatus, staged errors, questions, and sourceSummaries. Test recovery, provider/limit/schema failures, optional unknowns, partial no-ops, dry runs, and rollback retaining status/raw output/summaries.
- [ ] 3.2 Update CLI text/JSON to v2; test both statuses, explained diffs, summary/history separation, informational name-mismatch logs/JSON, partial/skipped-zero and failure-nonzero exits, multiple targets, and sanitized diagnostics.
- [ ] 3.3 Update eval producers, fixtures, and scorer to v2; remove the v1 gaps fallback; test explicit rejection of unsupported report versions, partial factual assertions, and failed-research scoring without citations.
- [ ] 3.4 Update report/eval guidance in `docs/development.md` and `docs/ingestion-process.md`, including private attribution and the new-format-only contract; verify `npm run docs:check`.

## 4. Integration and completion

- [ ] 4.1 Run `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test`; all must pass.
- [ ] 4.2 Run captured-page catalog evals; inspect statuses, reasons, source-summary accuracy, grouped facts, per-category availability, and link ownership against required/forbidden assertions. Record provider/credential limitations instead of claiming unrun checks passed.
- [ ] 4.3 After implementation, sync all deltas into their owning main specs and update index/lifecycle documentation; verify `npm run openspec:validate` and `npm run docs:check`.

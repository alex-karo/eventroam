# Tasks

**Prerequisite:** [rename-occurrence-to-edition](../archive/2026-10-11-rename-occurrence-to-edition/tasks.md), implemented and synchronized in the worktree. Exact mappings: [contracts](design.md#contract-changes). Acceptance cases: [refresh delta](specs/catalog/source-workflow/spec.md). Use offline providers and temporary databases. Refresh implementation has not started.

## 1. Refresh contracts and assignment

- [ ] 1.1 Unify CLI/Studio/invocation/stored input as batch refresh with full/current scope. Test early invalid/check/add-scope rejection, independent Event attempts, and Studio single-preview defaults. Update CLI/Studio docs and run docs:check.
- [ ] 1.2 Add assignment, field registry, all-saved-country baseline, pure resolver/resolveRefreshScope adapter/injected callback with the exact design contract, and native state. Test filled-field duties, full/current boundaries, latest-result consistency, mandatory targets, at most one missing target, strict input/output, absent/invalid calls, repeated selection changes, none-found/unresolved, and returned facts inconsistent with resolution. Update resolver docs and run docs:check.
- [ ] 1.3 Implement ongoing-first selection and stable-key matching. Test local/UTC inclusive dates, corrected years/dates, multiple weekends, ties/overlaps/year-only announcements, stale statuses/replacements/exclusions, none-found and unresolved cases.

## 2. Website recovery and atomic guard

- [ ] 2.1 Update scoped-refresh-v1 prompt/input/tools for assignments and wrong-site recovery; preserve current agent schema/reason/unresolved. Test replacement success, namesake/snippet ambiguity, exhausted recovery, strict/null handling, history coverage and completeness.
- [ ] 2.2 Guard baseline and all returned country facts before diffs/operations. Test sibling/new/unchanged/null conflicts, IE→AU/GB vetoes, failed durable reports, zero catalog/audit/receipt writes and no early external calls. Document recovery/guard diagnostics and run docs:check.
- [ ] 2.3 Reread baseline in atomic apply with expected versions. Test concurrent changes abort all writes, dry-run rollback, failure finalization and no replay after persistence failure.

## 3. Facts and reports

- [ ] 3.1 Derive operations and returned-fact confirmations from the unchanged agent output. Test normalized no-ops, omitted-field preservation, no synthetic completion, target/latest-resolution validation, failed/null-data without a resolver call, and complete typed baselines including base-price full_programme coverage.
- [ ] 3.2 Preserve complete qualified ticket blocks while checking shops/languages. Test packages/day/upgrades/concessions, readable prices, availability and unverified-category preservation.
- [ ] 3.3 Upgrade reports/readers/evals/Studio summaries to v3 and add a row-preserving migration removing the entire DB report check. Test application version validation, stored/exported equality, IDs, add/batch/preview/failure, historical v2 preservation/rejection, partial costs/scalars. Update report/ticket examples and run docs:check.
- [ ] 3.4 Preserve shared budgets/retries/final-step reservation and observability. Test exhaustion/oversize, invalid final response, native state, safe metadata, cancellation/resources, and no intermediate writes/page caps.

## 4. Verify and synchronize

- [ ] 4.1 Exercise Soma veto, Tremor history, Legacy tickets and current isolation offline; verify CLI/Studio parity and durable failures/previews.
- [ ] 4.2 Run relevant tests, then full test/type-check/lint/changed-code formatting checks. Require passing migration and contract regressions.
- [ ] 4.3 Reconcile implementation/delta and sync catalog/source-workflow/progress/index. Run openspec:validate, docs:check and active terminology/command searches. Leave archived docs/historical JSON unchanged.

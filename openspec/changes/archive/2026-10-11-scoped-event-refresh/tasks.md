# Tasks

**Prerequisite:** [rename-occurrence-to-edition](../2026-10-11-rename-occurrence-to-edition/tasks.md), implemented and synchronized in the worktree. Exact mappings: [contracts](design.md#contract-changes). Acceptance cases: [refresh delta](specs/catalog/source-workflow/spec.md). Use offline providers and temporary databases. Model-led refresh and verification removal are implemented and validated. Earlier review/evals remain historical evidence in build progress.

## 1. Refresh contracts and assignment

- [x] 1.1 Unify CLI/Studio/invocation/stored input as batch refresh with full/current scope. Test early invalid/check/add-scope rejection, independent Event attempts, and Studio single-preview defaults. Update CLI/Studio docs and run docs:check.
- [x] 1.2 Replace dynamic assignment/resolution with static scope/referenceInstant/saved Editions/fieldRegistry/rules/country baseline. Remove resolver tool, schemas, callback and recording state. Test complete context and absence of the protocol; update context docs.
- [x] 1.3 Put ongoing/local-date/stable-key/cancellation/replacement/ambiguity rules in prompt and structured context. Add separate model evals for temporal selection and research completeness, including unchanged saved history in raw model output.

## 2. Website recovery and atomic guard

- [x] 2.1 Update scoped-refresh-v2 prompt/input/source tools for model-led full/current duties and wrong-site recovery, preserving agent schema/reason/unresolved. Verify final success/partial needs no intermediate call and recovery fixtures pass.
- [x] 2.2 Guard baseline and all returned country facts before diffs/operations. Test sibling/new/unchanged/null conflicts, IE→AU/GB vetoes, failed durable reports, zero catalog/audit/receipt writes and no early external calls. Document recovery/guard diagnostics and run docs:check.
- [x] 2.3 Reread baseline in atomic apply with expected versions. Test concurrent changes abort all writes, dry-run rollback, failure finalization and no replay after persistence failure.

## 3. Facts and reports

- [x] 3.1 Replace latest-resolution/temporal checks with simple scope bounds: current at most one Edition; full at most one new key and a total target union of 20. Test rejection before writes, retained country/target guards and preserved raw named facts and existing writer audit.
- [x] 3.2 Preserve complete qualified ticket blocks while checking shops/languages. Test packages/day/upgrades/concessions, readable prices, availability and unverified-category preservation.
- [x] 3.3 Keep report v3 and the row-preserving DB-check migration; remove resolved assignment/selection/resolution, verification and returnedFacts/verifiedFactCount from preparation, reports, Studio, tracing and active consumers. Test static context, saved/returned counts, privacy and stored/exported equality; update examples.
- [x] 3.4 Remove resolver-specific provider/tracing/fixture tests while retaining shared limits, final-step reservation, cancellation/resources and no intermediate writes/page caps. Verify direct final responses and source-only tool calls.

## 4. Verify and synchronize

- [x] 4.1 Exercise Soma veto, Tremor history, Legacy tickets and current isolation offline; verify CLI/Studio parity, durable failures/previews and selection/completeness evals independently of mutation scores.
- [x] 4.2 Run affected tests, then full test/type-check/lint/format checks. Run fixed-source model evals and record remaining model-quality/budget failures honestly. Remove input-character limits/configuration/report fields, default to 15 model steps and verify large-context final responses and step exhaustion.
- [x] 4.3 Sync revised catalog/source-workflow and current progress/index/docs after implementation. Run openspec:validate, docs:check and active resolver-contract searches; preserve historical records.

# Tasks

Implementation details and case coverage are defined in [design](design.md) and the [delta specs](specs/catalog/source-workflow/spec.md).

## 1. Baseline and contracts

- [x] 1.1 Capture the five-case baseline before changing contracts; verify fixtures, revision/settings, actual writes, total cost and duration against the design's quality check.
- [x] 1.2 Align research/editor contracts, compact context and provider normalization; document them and verify regression coverage for omission/refutation, complete classification, free tickets, ready/rejected output and required arrays.

## 2. Preparation and execution

- [x] 2.1 Replace direct research writes with typed editorial preparation and remove obsolete logic; verify supported accept/set/clear/keep actions, atomic rejection, preserved blocks, target/country/version guards and publication rules with regression tests and the owning specs.
- [x] 2.2 Integrate one bounded editor call into CLI/Studio, report v5, usage and diagnostics; document the workflow and verify parity, partial/failed/skipped editing, cancellation, dry-run, retained output, persistence and accounting regressions.
- [x] 2.3 Remove the source-link depth limit and related code/configuration/diagnostics; align docs/specs and verify longer link chains, deadline exhaustion and retained request accounting.

## 3. Evaluation and integration

- [x] 3.1 Add documented editor-only replay of validated research handoffs; verify mode/provenance/accounting, actual writes, provider-schema regressions and captured-response replay using the existing eval runner.
- [x] 3.2 Compare the five baseline cases on the editor pipeline; verify expected/actual writes and total cost/duration, recording the smoke comparison's limitations as described in design.
- [x] 3.3 Run integration tests, type-check, lint, dependency and formatting checks; reconcile overlapping changes, sync owning specs and pass docs/OpenSpec checks, distinguishing unrelated incomplete proposals.

## 4. Editor identity simplification

- [x] 4.1 Remove editor Event IDs/names and nested target/create unions; derive Event identity from validated input/research and resolve Editions by key, retaining creation reasons and matching-research requirements. Align contracts/prompts/fixtures/specs/docs and verify scope/country/clear/identity guards with regression tests and applicable checks.

## 5. Source inspection correction

- [x] 5.1 Exclude page Markdown from workflow state and phase outputs while retaining research access and failure/cancellation accounting; align documentation and verify native state and Studio transport regressions.

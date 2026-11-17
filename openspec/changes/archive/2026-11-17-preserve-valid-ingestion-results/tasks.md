# Tasks

Follow [proposal.md](proposal.md) for required results and [design.md](design.md) for the repair flow and safety boundaries. Use deterministic model replies and disposable catalog fixtures.

## 1. Return disputed field proposals

- [x] 1.1 Change field choices in `reviewPaths` to follow the design. Keep item and target choices unchanged. Extend Editor tests to verify the first classification return, unchanged optional omissions, and approval after the last allowed return.
- [x] 1.2 Align Editor instructions and prompt versions with the new choices. Cover correction, whole-group withdrawal, and comparison with the current proposal. Verify that a settled withdrawal needs no extra return and that Editor still cannot supply replacement values.
- [x] 1.3 Update the review routing rules in `docs/ingestion-process.md`. Check agreement with the path policy and run `pnpm run docs:check`.

## 2. Handle local repair errors within the existing limit

- [x] 2.1 Keep boundary failures fatal and use `GroupIssue` for all local results, including omission reasons. Extend repair unit tests with a valid peer beside a changed fixed target, unknown reference, or country conflict. Verify that these boundary failures still propagate and that omission checks run before merge.
- [x] 2.2 Merge valid requested groups independently and keep failed groups out of usable output. Continue other owners after local errors. Extend repair unit tests for mixed groups and owners. Verify that a valid correction survives, unrequested fields stay unchanged, and a disputed original proposal cannot reappear.
- [x] 2.3 Return only locally invalid groups within the shared per-path allowance. Keep valid peer revisions between attempts and record rejection at exhaustion. Cover validation-triggered and Editor-triggered repairs. Verify shared counts, exact-path omission feedback, acceptance of the final valid reply, and termination after repeated invalid replies.
- [x] 2.4 Update scoped repair and limit rules in `docs/ingestion-process.md`. Describe local rejection and fatal boundaries. Verify the guide against the focused repair tests and run `pnpm run docs:check`.

## 3. Finish review, apply, and report independent results

- [x] 3.1 Read terminal code rejections from the latest `RepairRecord.decision` for each path and copy them into the workflow review map. Keep the existing repair return value. Exclude rejected groups from later model review and retain their final decisions. Extend an existing dependency workflow case to verify that a code rejection reaches `applyReview` while an independent change survives. Run existing temporal and reuse dependency tests instead of adding another matrix.
- [x] 3.2 Add one mixed-success workflow regression for the ticket-link and social-omission case. Verify final Editor approval, preserved saved values, the accepted correction, operations, and receipts. Check preview on this repair path. Reuse existing checks for general preview/apply agreement, publication gates, cancellation, and transaction rollback. Retain one workflow check that a fatal boundary error prevents writes despite a valid peer.
- [x] 3.3 Record final local failures as exact-path unresolved work and partial research. Add report and lifecycle assertions to the mixed-success case from 3.2, including an originally verified check and the actual catalog outcome. Add recovered-status assertions to the return-limit coverage from 2.3. Keep earlier failures as history without treating them as final rejection. Update report inspection in `docs/ingestion-tools.md` and run `pnpm run docs:check`.

## 4. Check the complete change

- [x] 4.1 Run the affected Editor, repair, proposal, report, and workflow tests. Run `pnpm run type-check`, `pnpm run lint`, `pnpm run docs:check`, and `pnpm run openspec:validate -- preserve-valid-ingestion-results`. Verify that all applicable checks pass without paid evals or production access.
- [x] 4.2 Complete the repository code review, project cleanup, and OpenSpec verification workflows. Resolve supported findings and verify the final implementation against the proposal acceptance criteria before archive.

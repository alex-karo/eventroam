# Tasks

## 1. Workflow storage and file ownership

- [x] 1.1 Pin compatible `@mastra/libsql` and add the shared factory. Verify native snapshot save/close/reopen with only intended domains.
- [x] 1.2 Add the workflow path and shared file preflight from [design](design.md#storage-and-hosts). Test custom catalog paths, relative paths, symlinks, and inode aliases. A real CLI workflow/report collision must leave files unchanged before report writing.
- [x] 1.3 Update `.env.example`, `docs/development.md`, and `docs/project-structure.md` for paths and ownership. Run `npm run docs:check`.

## 2. Shared workflow snapshots and failure handling

- [x] 2.1 Enable snapshots and both initialization IDs; keep retries/restart off. Replace the transport 404 assertion with saved list/detail checks. Verify saved steps, ID correlation, and separate workflow/research/editor/Location/catalog outcomes.
- [x] 2.2 Add [storage recovery](design.md#storage-failures-and-recovery). Inject failures before work, between steps, after apply before report, and after report. Assert safe history errors, nonzero CLI, retained commits/reports, and one-time cleanup without replay.
- [x] 2.3 Add [execution guards](design.md#execution-guards). After reopen, test old IDs through HTTP start variants and direct SDK start: no dependency calls, new attempt, or history change; HTTP rejection precedes acknowledgment. Test stops before/after attempt allocation, first later snapshot failure, and start-write failure. Confirm no pending reset or allocation after failed start writes. Keep unsupported-route tests.
- [x] 2.4 Prune saved request context. Send sentinels through native start; inspect full snapshots and detail API. Keep allowed model text and Location/geocoding data; exclude separate bodies, credentials, authenticated URLs, prompts, transport data, and raw errors.
- [x] 2.5 Document inspection, status/UI limits, and required-history failures in `docs/ingestion-process.md`. Run `npm run docs:check`.
- [x] 2.6 Remove the repeated input schema parse in `onStart`; use the input already validated by Mastra. Verify schema defaults still apply and invalid input starts no durable attempt or external work.

## 3. CLI and Studio hosts

- [x] 3.1 Register per-Event CLI hosts and isolate test/eval stores. Command tests verify distinct entries, retained reports with nonzero history failures, and no owner-store access from tests, evals, help, or invalid syntax.
- [x] 3.2 Connect Studio domains and development/production paths. Verify graph/history access without catalog/model prerequisites and correct provider closure.
- [x] 3.3 Extend the offline process fixture: CLI exits, then Studio reopens its store with logs/traces off. Verify preview rollback, per-Event entries, failed outcomes, and saved interrupted progress.
- [x] 3.4 Test completed-run deletion preserves catalog facts, audit, reports, and observability. Document deletion/reset, manual retention, and lost ID evidence in `docs/development.md`; run `npm run docs:check`.
- [x] 3.5 Document UI questions, default CLI history, and DuckDB process limits. Verify the offline inspection instructions and run `npm run docs:check`.
- [x] 3.6 Set Compose `/data` and temporary build storage paths. Extend disposable Compose smoke: create a pending entry without ingestion, recreate Studio, inspect the same ID without model credentials. Run `npm run docker:smoke`; update build/replacement instructions and run `npm run docs:check`.
- [x] 3.7 Let `workflow.createRun()` generate CLI execution IDs. Remove the local `randomUUID()` import and call; use the distinct-entry checks in task 3.1 to verify fresh IDs.

## 4. Integration checks

- [x] 4.1 Use built-in Browser and offline stores: Recent runs, detail after reload, steps, and separate workflow/catalog results. Record observations without paid research.
- [x] 4.2 Run `npm run type-check`, `npm run lint`, `npm run deps:check`, `npm test`, `npm run docs:check`, `npm run openspec:validate`, and changed-file formatting checks. Resolve failures caused by this change.

## Validation notes

Built-in Browser: an offline CLI preview appeared in Recent runs. Its detail, step times, initialization IDs, and output survived reload. The output showed `dryRun: true`, `outcome: updated`, and separate research, editor, Location, and report statuses. No paid research was used.

Compose smoke: a native pending entry survived Studio replacement in a disposable volume without model credentials.

Checks passed: 762 tests; final storage and HTTP checks; type-check, lint, dependency rules, docs, OpenSpec (19 items), changed-file formatting, Studio build, and disposable Compose smoke.

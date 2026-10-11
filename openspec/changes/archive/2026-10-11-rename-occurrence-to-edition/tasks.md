# Tasks

Exact mappings: [contracts](design.md#contract-changes). Acceptance cases: [records delta](specs/catalog/records/spec.md) and [report boundary](specs/catalog/source-workflow/spec.md). Use temporary databases; scoped refresh is a separate follow-up.

## 1. Rename existing code and contracts

- [x] 1.1 Rename catalog types/DTOs, operation kinds/owners, reads/writes, ingestion adapters/metadata, UI filenames/imports, fixtures/tests and schema exports. Verify type-check and targeted tests, strict old-name rejection, unchanged agent/public output, URLs, IDs/keys and domain rules. Update active report/eval fixtures to Edition while keeping version 2; remove tests requiring old report reading/scoring, without adding compatibility adapters.
- [x] 1.2 Update current docs/examples and spec terminology alongside the rename, preserving research behavior and archived documents. Run docs:check and active terminology search; verify terminology-only prompt edits preserve behavior/version, report version 2 and existing commands. Remove historical-report readability promises via the source-workflow delta.

## 2. Migrate SQLite storage

- [x] 2.1 Add the forward table/column/index/constraint rename migration and matching Drizzle metadata; keep old migrations immutable and the report check intact. Verify fresh and populated legacy schemas, FKs, uniqueness, ownership checks and immutable-audit triggers.
- [x] 2.2 Test preserved facts, versions/publication, terms/links/aliases, byte-identical audit/run JSON and receipt keys/hashes/results, migration rerun safety and operation replay/collision rules. Update migration/backup guidance and run docs:check.

## 3. Integration and specification completion

- [x] 3.1 Run relevant catalog/ingestion/public-read/migration tests, then full test/type-check/lint and changed-code formatting; require passing contract regressions.
- [x] 3.2 Reconcile implementation/deltas, sync owning specs and progress/index, and run openspec:validate/docs:check. Verify scoped refresh remains unimplemented and its separate plan references the completed rename.

## Verification

Applied on main `00eb481`. Full suite: 480 tests / 43 files; the final old-contract payload refinement also passed all 29 writer tests. Type-check, lint, full formatting, production build, docs:check and openspec:validate passed. Drizzle Kit reports no schema changes. Migration tests cover populated schemas 0000–0004 and reruns; normal tests initialize fresh databases. Historical migrations, agent/wire contracts, command options, budgets and run persistence are byte-identical to main; prompt changes are terminology only. Main specs are synchronized. No owner database, paid provider or deployment was used. Scoped refresh remains 0/13.

Final verification: 6/6 tasks, all 5 requirements and 14 scenarios checked; both deltas match main specs. Repeated migration/writer/eval checks passed 66 tests and type-check. Review finding REV1 (renamed opaque IDs in eval fixtures) was accepted without correction by the owner; existing database IDs remain preserved.

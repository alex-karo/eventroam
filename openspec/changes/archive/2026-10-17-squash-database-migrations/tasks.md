# Tasks

## 1. Baseline and database verification

- [x] 1.1 Replace the nine migrations and snapshots with one generated baseline plus the four immutability triggers; verify fresh `db:migrate` and Drizzle Kit schema comparison succeed.
- [x] 1.2 Replace old-schema upgrade tests with focused fresh-schema, fixture, and repeat-migration checks; verify database tests pass and the new baseline matches the old chain's final schema.

## 2. Current contracts and guidance

- [x] 2.1 Remove obsolete upgrade requirements from the owning main specs; verify `npm run openspec:validate` passes.
- [x] 2.2 Replace obsolete migration-specific development guidance with reset and backup instructions; verify `npm run docs:check` passes.

## 3. Integration

- [x] 3.1 Run the relevant test suite, type check, lint, and migration commands on a temporary database; verify all pass and no local catalog is changed.

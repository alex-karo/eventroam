# Tasks

## 1. Reference-data migration

- [x] 1.1 Add the SQL migration and journal entry using the selected vocabulary document. Verify fresh, partially populated, and repeated migrations as described in design.md, including shared validation, parent links, and preservation of existing IDs and assignments.

## 2. Fixture and test setup

- [x] 2.1 Make development and test fixtures look up migrated terms. Keep test databases migrated and use separate synthetic terms for custom scenarios without clearing the vocabulary. Retain the eval suite’s isolated vocabulary setup inside its seed transaction. Verify fixture repeatability and migrated-term reuse; remove only the failed-seed taxonomy row-count assertion.

## 3. Setup documentation

- [x] 3.1 Update the vocabulary document's implementation status, the development guide's `db:migrate` instructions, and the index description. Check the documented terms and parents against the migration and run `npm run docs:check`. Update project-structure documentation only if implementation makes an existing statement inaccurate.

## 4. Integration checks

- [x] 4.1 Run the ordinary unit/integration suite, type checking, lint, dependency checks, changed-file formatting, docs checks, and strict OpenSpec validation once. Verify no publication rules, main specs, or working-catalog records changed; do not run ingestion or model evals.

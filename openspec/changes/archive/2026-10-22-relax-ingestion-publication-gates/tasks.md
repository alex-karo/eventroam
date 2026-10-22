# Tasks

## 1. Relax the shared publication gates

- [x] 1.1 Update the location and classification checks in `src/catalog/domain/validation.ts` as described in the delta spec. Update existing domain and writer tests to cover country-only publication, arbitrary valid classification values, and rejection of missing required facts or facets. Verify with `npm test -- src/catalog/domain/validation.test.ts src/catalog/write/apply-operation.test.ts`.
- [x] 1.2 Update the existing ingestion publication cases in `src/ingestion/editor/prepare.test.ts` for the relaxed gates. Cover publication through a historical Edition while a new undated Edition stays draft. Verify that prepared publication operations pass the writer with `npm test -- src/ingestion/editor/prepare.test.ts`.
- [x] 1.3 Apply the delta to the owning main publication spec and explain the minimum publication facts in `docs/ingestion-process.md`. Verify with `npm run openspec:validate` and `npm run docs:check`.

## 2. Check integration

- [x] 2.1 Run `npm run type-check` and the catalog and ingestion test suites with `npm test -- src/catalog src/ingestion`. Confirm the final diff contains no rendering, storage-schema, or additional ingestion-policy changes.

# Design

## Change size

Medium. The change adds reference data without changing the schema or classification rules. Existing term IDs must survive, and fixtures that own their vocabulary need adjustment. No new dependency is needed.

## Approach

Append one SQL data migration after `0000_initial`. The existing Drizzle migrator owns sequencing, transactions, and the journal. Use the 71 terms and parent relationships in the [vocabulary document](../../../docs/proposals/festival-taxonomy-vocabulary.md): 56 genres and 15 terms in the other facets.

Insert parents before children. Match existing rows by `(facet, slug)` with a targeted conflict clause. Give new terms stable IDs, such as `catalog:term:genre:deep-house`, and resolve parent IDs from the stored rows. Preserve existing IDs, labels, parents, and assignments, including terms outside the starter vocabulary. Do not use broad `INSERT OR IGNORE` or edit the applied baseline.

This fills the dictionary used by existing classification and publication rules. It does not assign terms, publish Editions, run ingestion, add diagnostics, or introduce a command. The existing contracts remain unchanged; `skip_specs: true` applies.

## Fixtures and temporary databases

Development fixtures must look up migrated terms by facet/slug instead of inserting their own `dev-*` terms. Keep shared validation for their normal catalog writes.

Test databases retain the migrated vocabulary. Shared fixtures look up existing terms by facet/slug, including the terms required by published scenarios. Tests that need custom hierarchies create separate synthetic terms through existing validators without clearing the dictionary. No empty-vocabulary option is needed.

The eval suite owns a separate controlled vocabulary. In its fresh temporary database, clear `taxonomy_terms` inside the existing seed transaction before loading custom terms with existing validators. Remove the failed-seed taxonomy row-count assertion; retain rollback checks for Events, Editions, assignments, and links. Do not clear vocabulary in an existing working catalog or run live ingestion/model evals.

## Verification and documentation

Cover three migration outcomes in temporary databases:

- Fresh catalog: all selected terms and parent links exist, shared taxonomy validation passes, and no Event or Edition is created.
- Partially populated catalog: imported IDs and assignments survive, missing terms are added, and new children reference the stored parent IDs.
- Repeated migration: terms and assignments stay unchanged; extend existing repeatability coverage.

Check fixture repeatability and reuse of migrated terms with adjacent tests. Keep existing discovery tests; this change needs no separate genre-filter scenarios or artificial primary-key collision test.

The vocabulary document owns term definitions and assignment guidance. After implementation, update its migration status and `docs/development.md` to describe vocabulary loading through `db:migrate`; keep the index description aligned. Change `docs/project-structure.md` only if it contains a statement made inaccurate by implementation.

Finish with one integration pass: ordinary unit/integration tests, type checking, lint, dependency checks, changed-file formatting, documentation checks, and strict OpenSpec validation. Use temporary databases throughout; no browser testing or working-catalog migration is required.

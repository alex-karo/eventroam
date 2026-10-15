# Tasks

## 1. Complete catalog validation before removing SQL rules

- [x] 1.1 Add missing size, price-detail, and caller-supplied fixture version/owner checks to existing validators and operation schemas; retain writer-generated version/audit ownership guarantees without separate storage-row validators, and verify by reusing or extending existing validator/fixture tests for invalid and valid nullable/default inputs.
- [x] 1.2 Add transaction-aware taxonomy ancestry and alias Edition/Event ownership checks to existing validation boundaries; verify self-parenting, multi-level cycles, malformed ancestry termination, mismatched alias ownership, and valid relationships with integration tests.
- [x] 1.3 Reuse existing catalog validation calls and connect only missing checks in the writer, development fixtures, and normal test helpers, requiring a transaction for relation-dependent checks; extend existing tests only where needed to verify rejected writes leave records, versions, audits, and receipts unchanged and valid fixtures still load.

## 2. Complete ingestion persistence validation

- [x] 2.1 Keep the current start/finalize operations in `src/ingestion/runs.ts`: use validated input consistently for scalar/JSON mode, preserve fixed lifecycle construction and existing accounting validation, and fill only uncovered gaps; reuse or extend run-persistence tests to verify the removed SQL rules remain enforced through supported operations, including nullable model cost and existing errors.
- [x] 2.2 Retain the conditional running/mode update and affected-row check without adding read-back, complete-row schemas, or validation-only transactions; use existing tests with targeted additions to verify duplicate/wrong-mode finalization cannot overwrite history, research stays outside transactions, and persistence-failure reports retain their behavior.

## 3. Migrate the database boundary and publish its policy

- [x] 3.1 Remove all 20 CHECK constraints from the Drizzle schema and generate/review a forward migration and snapshot that remove only the two validation triggers; verify final schema inspection shows zero CHECK constraints, exactly the four retained immutability triggers, and unchanged keys, indexes, defaults, and required columns.
- [x] 3.2 Extend existing migration tests for populated upgrade, fresh initialization, and repeated migration; verify row preservation, byte-identical audit/receipt/run JSON, foreign-key checks, retained uniqueness/NOT NULL rules, and all four immutability triggers through the supported migrator.
- [x] 3.3 Update database boundary tests to accept removed value/relationship rules through deliberate raw SQL while supported application paths reject equivalent invalid writes; verify focused catalog, fixture, ingestion, and database tests pass against the migrated schema.
- [x] 3.4 Update ADR 001 and add the database policy from design.md to repository `AGENTS.md`, including links to the ADR and storage-integrity spec; sync the implemented delta into `openspec/specs/operations/storage-integrity/spec.md` and update documentation navigation, then verify `npm run docs:check` and `npm run openspec:validate` pass and current/future behavior is described consistently.

## 4. Verify integration

- [x] 4.1 Run `npm run type-check` and `npm test` after the complete migration/validator change; verify replay safety, publication/classification behavior, dry-run rollback, durable run history, and existing public contracts remain unchanged.

## Verification record

- All 577 tests passed across 46 files; the 13 affected validation/migration tests also passed after the final helper extraction.
- Type checking, lint, dependency checks, documentation checks, and scoped strict OpenSpec validation passed.
- The repository-wide `npm run openspec:validate` was run: this change and the new main spec pass; the pre-existing `narrow-current-refresh` change fails because it has no delta specs. That unrelated proposal was left unchanged.
- Migration tests cover fresh databases, populated upgrades from 0000–0007, repeated migration, retained schema structure, immutable history, and byte-preserved serialized payloads. The owner's local database was not migrated during implementation.

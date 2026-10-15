# Proposal

## Why

SQLite still owns 20 value/relationship checks and two validation triggers, including ingestion status vocabulary and lifecycle rules. Keeping these rules in shared application validators will let contracts and vocabularies evolve without rebuilding tables and will make validation ownership explicit for future schema changes.

## What Changes

- Move all current `CHECK` constraints and the taxonomy-cycle and alias-Edition-ownership validation triggers into application validation, preserving accepted catalog and ingestion behavior.
- Retain primary keys, foreign keys, uniqueness, `NOT NULL`, indexes, defaults, transactions, and the four audit/URL-alias immutability triggers in SQLite.
- Extend existing operation validators and fixture validation only where checks are missing. Keep related-state checks inside catalog write transactions; preserve ingestion's current start/finalize operations and atomic conditional update.
- **BREAKING**: Direct SQL will no longer enforce the removed value and relationship rules. Supported application write paths remain responsible for rejecting invalid data.
- Add a data-preserving migration and extend existing tests to prove application rejection and the narrower database boundary. Do not introduce complete storage-row schemas, a new persistence layer, or extra ingestion reads/transactions solely for validation.
- During implementation, update ADR 001 and repository `AGENTS.md` with the enduring rule: evolving values, JSON shapes, and business relationships belong in code; future schema work must preserve this boundary. No separate skill is needed.

## Capabilities

### New Capabilities

- `operations/storage-integrity`: Ownership of application validation versus SQLite integrity, validated write boundaries, and data-preserving schema evolution.

### Modified Capabilities

None. Existing catalog, classification, routing, and ingestion acceptance rules remain in force; this change specifies where they are enforced.

## Impact

Affected areas include `src/db/schema.ts`, a new migration and snapshot, `src/catalog/domain/validation.ts`, `src/catalog/write/validate-values.ts`, `src/catalog/write/apply-operation.ts`, `src/ingestion/runs.ts`, fixture helpers, database/validation tests, ADR 001, `AGENTS.md`, and documentation navigation. No dependencies or public API changes are required. New vocabulary values, new ingestion statuses, hosted ingestion, and changes to audit or URL immutability are out of scope.

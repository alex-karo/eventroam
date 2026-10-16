# Proposal

## Why

The catalog has nine migrations for intermediate development schemas. Before public deployment, one baseline will make fresh databases simpler to initialize and keep obsolete validation rules out of the supported migration path.

## What Changes

- **BREAKING** Replace the nine SQL migrations and Drizzle snapshots with one migration for the current schema. Existing databases with the old migration history must be recreated; upgrading them is unsupported.
- Preserve current relational constraints, indexes, defaults, and the four immutable-history triggers in the new baseline.
- Replace legacy upgrade tests with fresh initialization, schema-integrity, and repeat-migration checks.
- Remove obsolete migration guarantees and instructions from current specs and development documentation. Git history retains the old migration files.

## Capabilities

### Modified Capabilities

- `operations/storage-integrity`: Replace validation-boundary upgrade guarantees with fresh baseline initialization and repeat-migration guarantees.
- `catalog/records`: Remove the Edition rename and size-field upgrade guarantees, which no longer describe supported migrations.

## Impact

The migration directory, Drizzle metadata, migration tests, current OpenSpec specs, and development documentation change. The catalog schema and supported application write contracts do not change.

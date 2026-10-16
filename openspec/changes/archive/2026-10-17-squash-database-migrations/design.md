# Design

## Change size

Medium. The database shape and application contracts stay the same, but the migration history and its tests and documented upgrade promises change together. The main risk is omitting schema objects that Drizzle does not generate.

## Approach

Generate a fresh `0000` migration and snapshot from `src/db/schema.ts`, then add the four audit and URL-alias immutability triggers to the reviewed SQL. Remove the old migration files and snapshots. Keep the existing migration command and fixture loader. The [proposal](proposal.md) and [delta specs](specs/operations/storage-integrity/spec.md) define the supported behavior.

## Contracts

`db:migrate` initializes an empty SQLite catalog and can run again without changing data. Databases with an earlier migration journal are outside the supported contract and must be recreated. Migration SQL contains structural constraints only; application code continues to own business validation. Fixtures remain a separate repeatable data operation.

## Key decisions

The baseline comes from the current Drizzle schema so future generated migrations compare against the same snapshot. The four immutability triggers remain reviewed SQL because the TypeScript schema does not express them. Fresh initialization and rerun checks belong in tests and development guidance rather than a durable catalog requirement. No compatibility bridge or old-database journal rewrite is added, consistent with the owner's decision to drop old-schema support.

## Risks and validation

- Compare fresh databases created by the old chain and new baseline using `sqlite_schema` and relevant PRAGMAs. Exclude only migration journal hashes and timestamps from that comparison.
- Exercise fresh migration, fixtures, repeat migration, foreign keys, indexes, defaults, absence of business CHECK constraints, and all four immutability triggers.
- Run Drizzle Kit generation once more after the baseline is installed; it must report no schema changes.
- Remove tests and current guidance that promise upgrades from old schemas. Valuable local data should be backed up before a developer recreates a database; this change does not touch any local database file.

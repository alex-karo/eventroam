# Spec Delta

## ADDED Requirements

### Requirement: Fresh catalog initialization is repeatable

The supported migration command SHALL initialize a fresh catalog with the current tables, defaults, relational constraints, indexes, and immutable-history protections. Running it again on that catalog SHALL preserve the schema and stored data without repeating the baseline.

#### Scenario: Fresh database is initialized

- **WHEN** the migration command opens an empty database
- **THEN** the current catalog schema is available with its relational constraints and immutable-history protections

#### Scenario: Initialized database is migrated again

- **WHEN** the migration command reopens a database initialized by the current baseline
- **THEN** it leaves stored data and migration history unchanged

## REMOVED Requirements

### Requirement: Validation-boundary migrations preserve stored data

**Reason**: The supported baseline already uses application-owned validation. Upgrades from older validation-boundary schemas are no longer supported.

**Migration**: Recreate development databases from the new baseline. Keep any valuable old catalog in a separate backup outside the supported migration path.

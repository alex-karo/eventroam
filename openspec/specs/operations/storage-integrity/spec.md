# Storage integrity

## Purpose

Define the durable boundary between application-owned validation and database-owned relational and history integrity across catalog and ingestion writes.

## Requirements

### Requirement: Value validation belongs to the application

Supported catalog and ingestion writes SHALL enforce value vocabularies, numeric/date/coordinate rules, JSON shapes, status-dependent fields, exclusive ownership, and taxonomy relationships in application code. The database SHALL NOT enforce these rules through CHECK constraints or business-validation triggers. Extending an application's allowed vocabulary SHALL NOT require a database migration solely to change allowed values.

#### Scenario: Vocabulary is extended

- **WHEN** an allowed value is added to an existing text field without changing its storage representation
- **THEN** application contracts and validation determine its acceptance without rebuilding a table to amend allowed values

#### Scenario: Raw SQL bypasses value validation

- **WHEN** direct SQL writes a value that violates only an application-owned rule
- **THEN** the database does not reject it on that rule's behalf
- **AND** the equivalent supported application write rejects it

### Requirement: Supported writes enforce rules at operation boundaries

Supported writes SHALL enforce application-owned rules through input validation and controlled operation construction. Fixture loaders and normal test helpers SHALL use applicable shared validation for supplied values. Checks depending on persisted relationships SHALL use the same transaction as the write. Rejected writes SHALL retain no partial mutation, audit entry, or receipt from that write.

#### Scenario: Fixture supplies invalid Edition values

- **WHEN** a normal fixture loader supplies a partial coordinate pair, invalid size, or non-array price details
- **THEN** application validation rejects the write before committing the invalid record

#### Scenario: A taxonomy parent change creates a cycle

- **WHEN** a supported term write makes a term its own ancestor at any depth
- **THEN** application validation rejects the write without changing the stored taxonomy

#### Scenario: Alias references another Event's Edition

- **WHEN** a supported alias write pairs an Event with an Edition belonging to a different Event
- **THEN** application validation rejects the alias without reserving its path

### Requirement: Ingestion persistence validates lifecycle state

Ingestion start and finalization SHALL enforce input/mode agreement, allowed status, lifecycle consistency, nonnegative integer counts/duration, finite nonnegative costs, and boolean completeness through validated inputs and controlled state transitions. Finalization SHALL atomically affect exactly one matching running attempt and preserve persistence-failure reporting and nullable model-cost behavior.

#### Scenario: Invalid final accounting

- **WHEN** finalization supplies a negative or fractional token count, nonfinite cost, or invalid completion flag
- **THEN** application validation rejects the finalization and the stored running attempt remains unchanged

#### Scenario: Attempt is finalized twice

- **WHEN** finalization targets an attempt that is already finalized or has a different mode
- **THEN** it fails without overwriting the persisted result

### Requirement: Relational integrity and immutable history remain database enforced

The database SHALL retain primary keys, foreign keys, uniqueness, and NOT NULL constraints. Applied catalog-change history and public URL aliases SHALL remain protected against updates and deletes by the database. Transactional catalog changes, audit entries, and operation receipts SHALL preserve existing atomicity and replay safety.

#### Scenario: Direct SQL violates retained integrity

- **WHEN** direct SQL introduces a duplicate unique key, missing foreign-key target, or null required field
- **THEN** the database rejects the write

#### Scenario: Direct SQL rewrites immutable history

- **WHEN** direct SQL updates or deletes a catalog-change entry or public URL alias
- **THEN** the database rejects the mutation

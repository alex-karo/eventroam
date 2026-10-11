# Catalog records delta

## MODIFIED Requirements

### Requirement: Events and editions have separate durable identities

The catalog SHALL represent an Event as a durable named identity and each realization as a separate Edition. IDs SHALL be opaque and stable. The Event SHALL own its name, aliases, summary, slug, and publication state. The Edition SHALL own its edition facts, including dates, status, location, capacity, price, and classifications. Its key SHALL be unique within the Event and SHALL not claim its current dates.

#### Scenario: A festival holds two separate weekends

- **GIVEN** a festival with two discontinuous programme periods in one year
- **WHEN** both editions are recorded
- **THEN** each has its own Edition ID and key under the same Event, and the gap is not counted as event days

#### Scenario: An edition moves dates

- **GIVEN** a published Edition
- **WHEN** its accepted dates change
- **THEN** its Event ID, Edition ID, and public key remain stable

## ADDED Requirements

### Requirement: Active catalog contracts name Editions
Active catalog contracts SHALL use Edition terminology, including editionId/editionKey/editionYear, create/update/publish/withdrawEdition operations, and edition link owners. Existing Edition agent/public fields, stable IDs/keys and URL paths SHALL remain unchanged. Old Occurrence operation names and fields SHALL be rejected without aliases.

#### Scenario: An Edition operation is submitted
- **WHEN** a structurally valid createEdition or updateEdition operation is submitted
- **THEN** the catalog applies the existing identity, validation, version, audit and publication rules using Edition names

#### Scenario: An old operation name is submitted
- **WHEN** an active caller submits createOccurrence, updateOccurrence, publishOccurrence, withdrawOccurrence, an occurrence owner, or occurrence-prefixed DTO fields
- **THEN** validation rejects it before catalog writes

#### Scenario: Public and agent contracts already use Edition
- **WHEN** catalog internals are renamed
- **THEN** public editions with id/key/year, agent editions with key/year, questions/errors with editionKey, and actual URLs retain their existing shapes and values

### Requirement: Edition storage migration preserves catalog and history
The SQLite migration SHALL rename occurrences/occurrence_terms to editions/edition_terms and occurrence_id/key/year columns to edition_id/key/year. It SHALL preserve row values, relationships, validation/ownership rules, versions, publication, immutable audits, receipts and private run history. Historical serialized payloads SHALL remain unchanged.

#### Scenario: A populated legacy catalog is migrated
- **WHEN** migration runs on a database containing Events, Occurrences, terms, links, aliases, catalog changes, operation receipts and ingestion runs
- **THEN** the corresponding Edition records retain every ID/key/year and fact, related rows reference the same IDs, and all foreign keys, unique rules and audit protections remain effective
- **AND** audit JSON, receipt keys/hashes/results and historical run JSON remain byte-for-byte unchanged

#### Scenario: A fresh database or an already migrated database is opened
- **WHEN** the supported migration command initializes a fresh database or reruns after the Edition migration
- **THEN** the resulting schema supports the Edition contracts without losing data or repeating applied migrations

#### Scenario: A renamed payload reuses an old operation key
- **WHEN** a new Edition operation reuses a stored key whose receipt hash belongs to the old serialized payload
- **THEN** the existing different-payload check rejects it without duplicate writes or rewriting the receipt
- **AND** new identical Edition payload retries still return their saved result

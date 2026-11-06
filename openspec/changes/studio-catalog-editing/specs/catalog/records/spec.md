# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog operations are versioned and replay safe

The application SHALL validate typed catalog operations. An update operation SHALL require an expected version. An operation key SHALL make retries idempotent and reject a different payload or audit mode. Actual changes SHALL advance the version and follow the [audit rules](#requirement-catalog-writes-retain-changes-and-attribution). No-ops SHALL add no change entry. Development fixtures may bypass this history.

#### Scenario: A stale update is attempted

- **GIVEN** an Edition version newer than the operation's expected version
- **WHEN** the operation is applied
- **THEN** it fails without overwriting the newer record or adding an audit entry

#### Scenario: An applied operation is replayed

- **WHEN** the same operation key, payload, and audit mode are applied again
- **THEN** the previous result is returned with no duplicate catalog or audit write

#### Scenario: An operation key is reused with another audit mode

- **WHEN** the same operation key is submitted with a different audit mode
- **THEN** the catalog rejects it without applying another write

#### Scenario: An approved Studio edit is replayed after a later change

- **GIVEN** an applied Studio edit and a later change to the same record
- **WHEN** the same approved edit is replayed
- **THEN** the writer returns the saved result without applying the edit again

### Requirement: Official links are owned and resolved per edition

An ExternalLink SHALL belong to exactly one Event or Edition, with a kind, normalized HTTP(S) URL, and official flag. Public Edition details SHALL use official links on the Edition and inherit official Event links only for kinds not overridden by the Edition. Replacing links SHALL be a validated, versioned operation subject to the [audit rules](#requirement-catalog-writes-retain-changes-and-attribution).

#### Scenario: An edition overrides a ticketing link

- **GIVEN** an Event ticketing link and a different Edition ticketing link
- **WHEN** the Edition is read publicly
- **THEN** its own ticketing link is used, while other unoverridden official Event link kinds remain available

### Requirement: Catalog writes retain changes and attribution
The system SHALL commit catalog mutations and operation receipts atomically. Each actual mutation SHALL also record a `CatalogChange` with old and new values, actor, any supplied initiating owner, operation key, and apply time in the same transaction. The system MAY omit this entry only for a direct Studio edit with explicit audit omission in the approved proposal. The omission SHALL preserve validation, version updates, public URL aliases, and operation receipts.

#### Scenario: Dates and venue change
- **WHEN** a valid operation changes dates and venue
- **THEN** the audit records those old and new values with actor attribution

#### Scenario: An approved edit omits the audit entry
- **WHEN** the owner approves a direct link edit with audit omission selected
- **THEN** the catalog applies the edit and advances the owner's version
- **AND** the operation receipt is saved without a new `CatalogChange`

#### Scenario: An unaudited slug edit preserves public aliases
- **WHEN** the owner approves a slug change for a published Event with audit omission selected
- **THEN** the old Event and published Edition paths still redirect to their current paths

#### Scenario: Ingestion applies a change
- **WHEN** an add or refresh operation changes the catalog
- **THEN** the writer still records the `CatalogChange` that supports the ingestion report

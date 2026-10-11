## ADDED Requirements

### Requirement: Edition size represents approximate participant scale

An Edition SHALL expose optional `sizeEstimate`: a positive integer estimate of festival size in people, or null when unknown. It SHALL replace `capacityEstimate` in active catalog, research, and public contracts without aliases. Size SHALL describe participant scale rather than maximum occupancy or exact attendance, and SHALL remain optional for publication.

#### Scenario: Size validation
- **WHEN** an Edition write supplies a size
- **THEN** positive integers and null are accepted; zero, negatives, fractions, and the obsolete capacityEstimate field are rejected

### Requirement: Size migration preserves development catalog history

The size-field migration SHALL preserve numeric estimates, IDs, relationships, versions, publication, and immutable audit/receipt/run payloads. Migrated estimates SHALL remain approximate development data subject to rechecking under the new semantics.

#### Scenario: Catalog migration
- **WHEN** the supported migration initializes, upgrades, or reopens a database
- **THEN** the size contract is available without losing stored facts, rewriting historical payloads, or repeating applied migrations

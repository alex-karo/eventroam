## MODIFIED Requirements

### Requirement: Geocoding is bounded and independent of old points

Geocoding SHALL return bounded candidates and safe provider failures. Forward requests SHALL use the applicable country constraint and SHALL NOT bias results toward saved coordinates. Provider success SHALL NOT certify a festival venue. A provider failure SHALL NOT authorize invented coordinates or changes to otherwise applicable saved data.

#### Scenario: A saved point is wrong

- **WHEN** ingestion searches for a supplied venue
- **THEN** the saved point is available for comparison but is not sent as proximity bias

#### Scenario: No provider key is configured

- **WHEN** ingestion requests geocoding without a key
- **THEN** the tool returns unavailable without exposing configuration
- **AND** ingestion can still return a supported source-point or preservation decision

### Requirement: Location decisions retain their evidence

Each changed or cleared place field SHALL retain its target and reason grounded in source evidence or saved state. Coordinate choices SHALL retain the source point or geocoding candidate basis. Reuse of an earlier saved point SHALL identify its Edition. Unsupported point or saved-Edition references SHALL be rejected.

#### Scenario: Only a city is known

- **WHEN** research supplies Lisbon without a supported venue and the geocoder cannot establish one
- **THEN** the result reports the missing venue information without inventing an address or claiming venue precision

#### Scenario: An old venue is withdrawn without a confirmed replacement

- **WHEN** supplied evidence disproves venue A but does not establish venue B
- **THEN** uncertainty about B does not turn A into a confirmed current venue
- **AND** the decision retains the evidence against A

### Requirement: Location runs only for accepted Edition targets

Ingestion SHALL apply place changes only to accepted Edition targets. A duplicate add, declined creation, rejected identity, or absent Edition target SHALL produce no place changes for that target. Saved history SHALL remain context without becoming an update target. A place change SHALL NOT alter Event or Edition identity.

#### Scenario: The editor rejects the festival association

- **WHEN** evidence concerns another festival
- **THEN** no catalog changes are made

#### Scenario: Only the next Edition is accepted

- **WHEN** currentOrNextEdition is accepted and previousEdition is null
- **THEN** only the current-or-next key can receive place changes
- **AND** saved history remains unchanged

#### Scenario: Both Editions are accepted

- **WHEN** two distinct Edition targets are accepted
- **THEN** each can receive its own supported place change in the same atomic item

#### Scenario: Editor context is available

- **WHEN** Editor reviews selected targets and place proposals
- **THEN** it receives applicable source evidence, saved values, point records and available place questions
- **AND** absent explanations are not invented and rejected targets cannot be restored by a place proposal

### Requirement: Initial geocoding prepares Location context

Before Location runs, the application SHALL prepare available reverse context for the saved target point or its earlier saved point. Location SHALL choose forward queries within the shared budget. Place checks SHALL distinguish new venue evidence from saved points. A new venue SHALL NOT be combined with a withdrawn address. Source coordinates SHALL retain their owning object and year context. Equivalent geocoding inputs SHALL reuse available results while each Edition's applicability is assessed separately.

#### Scenario: Research establishes a new venue

- **WHEN** evidence establishes a new venue and disproves the saved address
- **THEN** the saved point remains available for comparison
- **AND** a forward query does not combine the new venue with that withdrawn address

#### Scenario: Two slots share their location inputs

- **WHEN** two selected Editions have the same saved coordinates
- **THEN** one available reverse result can serve as context for both without another provider request
- **AND** shared context does not prove that the venue applies to both

#### Scenario: A source directly identifies a venue point

- **WHEN** source text supplies a valid coordinate pair and its owning object
- **THEN** a place update can use that exact pair when it applies to the target
- **AND** ingestion does not generate latitude or longitude

### Requirement: Location owns a coherent place description

The final venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates SHALL describe one coherent place for each addressed Edition. A changed venue SHALL NOT retain an address or point disproved by the same evidence. Unsupported fields SHALL preserve saved data without claiming fresh verification. Invalid or inconsistent final place data SHALL reject the item.

Location SHALL supply explicit decisions for all place fields. Editor SHALL approve or reject those proposals without supplying replacement values. Other specialists SHALL NOT supply place changes.

#### Scenario: A new venue has an old address

- **WHEN** sources establish a new venue and show that the saved address belongs to the old venue
- **THEN** ingestion does not keep that address as if it belonged to the new venue
- **AND** it explicitly clears the disproved address or supplies a supported replacement

#### Scenario: Location data is incomplete but not disproved

- **WHEN** a field has no supported replacement or evidence against its saved value
- **THEN** the saved value is preserved without claiming fresh verification

#### Scenario: A text action is missing

- **WHEN** a Location proposal omits a decision for a place text field
- **THEN** validation rejects the whole item before writes

#### Scenario: Plans overlap in field ownership

- **WHEN** Editor supplies a replacement place value or Location supplies a non-location change
- **THEN** validation rejects the whole item before writes

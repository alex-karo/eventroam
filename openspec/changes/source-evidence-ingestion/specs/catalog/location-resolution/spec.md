## RENAMED Requirements

- FROM: `### Requirement: Location decisions retain their evidence`
- TO: `### Requirement: Place changes retain their evidence`

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

### Requirement: Place changes retain their evidence

Each changed or cleared place field SHALL retain its target and reason grounded in source evidence or saved state. Coordinate choices SHALL retain the source point or geocoding candidate basis. Reuse of an earlier saved point SHALL identify its Edition. Unsupported point or saved-Edition references SHALL be rejected.

#### Scenario: Only a city is known

- **WHEN** research supplies Lisbon without a supported venue and the geocoder cannot establish one
- **THEN** the result reports the missing venue information without inventing an address or claiming venue precision

#### Scenario: An old venue is withdrawn without a confirmed replacement

- **WHEN** supplied evidence disproves venue A but does not establish venue B
- **THEN** uncertainty about B does not turn A into a confirmed current venue
- **AND** the decision retains the evidence against A

### Requirement: Inheritance uses a stable historical source

Reuse of an earlier saved point SHALL identify its Edition and copied coordinates. That Edition SHALL NOT be defined solely by the previousEdition role. A tentative point chosen for another slot in the same run SHALL NOT become an earlier saved point. The application SHALL recheck the earlier Edition's version and point in the write transaction.

#### Scenario: The donor is not an update target

- **WHEN** an earlier saved Edition changes after research and before its point is copied
- **THEN** the whole item is rejected instead of copying a stale point

#### Scenario: Completion order is ambiguous

- **WHEN** the saved chronology cannot establish a suitable unique earlier Edition
- **THEN** the application does not silently choose one by row order or matching year

## ADDED Requirements

### Requirement: Location changes address only accepted Edition targets

Ingestion SHALL apply place changes only to accepted Edition targets. A duplicate add, declined creation, rejected identity, or absent Edition target SHALL produce no place changes for that target. Saved history SHALL remain context without becoming an update target. A place change SHALL NOT alter Event or Edition identity.

#### Scenario: The festival association is rejected

- **WHEN** evidence concerns another festival
- **THEN** no catalog changes are made

#### Scenario: Only the current-or-next Edition is accepted

- **WHEN** currentOrNextEdition is accepted and previousEdition is null
- **THEN** only the current-or-next key can receive place changes
- **AND** saved history remains unchanged

#### Scenario: Both Editions are accepted

- **WHEN** two distinct Edition targets are accepted
- **THEN** each can receive its own supported place change in the same atomic item

#### Scenario: Saved questions remain unresolved

- **WHEN** a selected target has unresolved place questions
- **THEN** those questions remain visible without fabricated explanations or unsupported changes

### Requirement: Place checks use applicable source and saved context

Place checks SHALL distinguish new venue evidence from target points and earlier saved points. A new venue SHALL NOT be combined with a withdrawn address. Source coordinates SHALL retain their owning object and year context. Equivalent geocoding inputs SHALL reuse available results while each Edition's applicability is assessed separately.

#### Scenario: A new venue replaces the saved venue

- **WHEN** evidence establishes a new venue and disproves the saved address
- **THEN** the saved point remains available for comparison
- **AND** a forward query does not combine the new venue with that withdrawn address

#### Scenario: Two targets share an old point

- **WHEN** two selected Editions have the same saved coordinates
- **THEN** one available reverse result can serve as context for both without another provider request
- **AND** shared context does not prove that the venue applies to both

#### Scenario: A source directly identifies a venue point

- **WHEN** source text supplies a valid coordinate pair and its owning object
- **THEN** a place update can use that exact pair when it applies to the target
- **AND** ingestion does not generate latitude or longitude

### Requirement: Location updates preserve a coherent place description

The final venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates SHALL describe one coherent place for each addressed Edition. A changed venue SHALL NOT retain an address or point disproved by the same evidence. Unsupported fields SHALL preserve saved data without claiming fresh verification. Invalid or inconsistent final place data SHALL reject the item.

#### Scenario: A new venue has an old address

- **WHEN** sources establish a new venue and show that the saved address belongs to the old venue
- **THEN** ingestion does not keep that address as if it belonged to the new venue
- **AND** it explicitly clears the disproved address or supplies a supported replacement

#### Scenario: Location data is incomplete but not disproved

- **WHEN** a field has no supported replacement or evidence against its saved value
- **THEN** the saved value is preserved without claiming fresh verification

## REMOVED Requirements

### Requirement: Location runs only for accepted Edition targets

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Location changes address only accepted Edition targets" retains the domain checks. Internal contracts belong in the design.

### Requirement: Initial geocoding prepares Location context

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Place checks use applicable source and saved context" retains the domain checks. Internal contracts belong in the design.

### Requirement: Location owns a coherent place description

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Location updates preserve a coherent place description" retains the domain checks. Internal contracts belong in the design.

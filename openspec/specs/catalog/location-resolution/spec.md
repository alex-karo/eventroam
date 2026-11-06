# location-resolution Specification

## Purpose

Define automatic, source-backed decisions for an Edition's venue, address, locality, country, and coordinates, with a preference for explicit official venue coordinates and otherwise applicable saved points.

## Requirements

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

### Requirement: Reverse results provide context only

A reverse result SHALL retain the queried point and bounded nearby place or address context. It SHALL NOT become a selectable replacement point, prove a mapping error, or change precision by itself. Location SHALL NOT assume the returned address contains the queried point. Location SHALL have no reverse geocoding or Place Details tool.

#### Scenario: Reverse geocoding returns a nearby building

- **WHEN** the provider returns a building address with coordinates different from the queried old point
- **THEN** Location can use it as nearby context without treating the old point as that building
- **AND** the returned pair is not registered as a selectable coordinate candidate

### Requirement: Location owns a coherent place description

The final venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates SHALL describe one coherent place for each addressed Edition. A changed venue SHALL NOT retain an address or point disproved by the same evidence. Unsupported fields SHALL preserve saved data without claiming fresh verification. Invalid or inconsistent final place data SHALL reject the item.

Location SHALL supply explicit decisions for all place fields. Editor SHALL approve, reject, or return the place group to Location under the group return rules. Editor SHALL NOT supply replacement place values. The complete place SHALL pass location validation. A return SHALL have no geocoding calls available and SHALL use the existing point choices. Other specialists SHALL NOT supply place changes.

#### Scenario: A new venue has an old address

- **WHEN** sources establish a new venue and show that the saved address belongs to the old venue
- **THEN** ingestion does not keep that address as if it belonged to the new venue
- **AND** it explicitly clears the disproved address or supplies a supported replacement

#### Scenario: Location data is incomplete but not disproved

- **WHEN** a field has no supported replacement or evidence against its saved value
- **THEN** the saved value is preserved without claiming fresh verification

#### Scenario: A text action is missing

- **WHEN** the final Location proposal omits a decision for a place text field
- **THEN** validation rejects the whole item before writes

#### Scenario: Plans overlap in field ownership

- **WHEN** Editor supplies a replacement place value or Location supplies a non-location change
- **THEN** validation rejects the whole item before writes

#### Scenario: The organizer spells the same venue differently

- **WHEN** a saved passage that Reader missed gives the spelling of the same venue for the selected Edition
- **AND** the address and the point from the earlier geocoding result still describe that venue
- **THEN** Editor can use the group's return and send Location its note and that passage
- **AND** Location can correct the venue name and use the same point without a new geocoding request
- **AND** location validation and the next Editor review can use the new citation

### Requirement: Location decisions retain their evidence

Each changed or cleared place field SHALL retain its target and reason grounded in source evidence or saved state. Coordinate choices SHALL retain the source point or geocoding candidate basis. Reuse of an earlier saved point SHALL identify its Edition. Unsupported point or saved-Edition references SHALL be rejected.

#### Scenario: Only a city is known

- **WHEN** research supplies Lisbon without a supported venue and the geocoder cannot establish one
- **THEN** the result reports the missing venue information without inventing an address or claiming venue precision

#### Scenario: An old venue is withdrawn without a confirmed replacement

- **WHEN** supplied evidence disproves venue A but does not establish venue B
- **THEN** uncertainty about B does not turn A into a confirmed current venue
- **AND** the decision retains the evidence against A

### Requirement: Coordinates come from registered points

Location SHALL choose coordinates from a registered supplied point, geocoding candidate, or historical donor. It SHALL NOT generate latitude or longitude. The application SHALL validate references and materialize the stored pair. Location SHALL also be able to lower its saved target point's precision with evidence, without changing coordinates. This action SHALL NOT increase precision or copy another target's point. Inheritance SHALL retain donor precision.

#### Scenario: A candidate does not belong to this run

- **WHEN** Location selects an unknown candidate ID
- **THEN** the plan is rejected without writes

#### Scenario: One venue applies to two Editions

- **WHEN** evidence supports the same registered candidate for both accepted Editions
- **THEN** both may select it with a separate explanation of applicability

#### Scenario: A source already supplies the venue point

- **WHEN** research supplies supported coordinates for the target venue
- **THEN** Location can select that supplied point without an additional geocoding request

#### Scenario: Saved precision overstates what the point represents

- **WHEN** evidence establishes that an applicable saved target point represents a locality but has precision exact
- **THEN** Location can lower its precision to locality without changing latitude or longitude
- **AND** the decision retains the evidence and does not claim a resolved venue

#### Scenario: A saved target reference tries to increase precision

- **WHEN** Location selects its saved target point with a higher precision
- **THEN** validation rejects the plan before writes

### Requirement: Precision describes the represented place

Precision SHALL describe what a point represents, not confidence. Exact SHALL mean a confirmed venue point; approximate SHALL mean an approximate point for a specific venue; locality SHALL mean a settlement point; region SHALL mean a regional point. Keep SHALL retain the saved pair and precision, and inherit SHALL copy the donor pair and precision. A same-target correction SHALL only lower precision, in that order, with evidence and unchanged coordinates.

#### Scenario: A city result has high provider confidence

- **WHEN** a provider confidently identifies a settlement point without establishing the venue point
- **THEN** its selected precision is locality rather than exact or approximate

### Requirement: Applicable saved coordinates have priority

Location SHALL prefer supplied coordinates that the festival's official site explicitly identifies as the target Edition's venue point, unless supplied evidence gives a concrete reason to reject them. Evidence that the point refers to another Edition, another object, an outdated venue, or conflicts with other established facts MAY defeat this preference. These coordinates SHALL take priority over a saved target point or historical donor without requiring a confirmed move or proof of an old mapping error. Distance from an old point or locality centre, failed geocoding, no venue match, and locality-only results SHALL NOT alone disprove the site's venue point. Material unexplained discrepancies SHALL remain in unresolved; they SHALL NOT alone prevent selection or require lower precision.

Otherwise Location SHALL prefer an applicable saved target point. When target coordinates are absent, it SHALL prefer a suitable historical point unless evidence supports its rejection or a better correction. Keeping target coordinates and inheriting history SHALL be distinct actions. Preserving or inheriting a point SHALL NOT imply fresh verification or improved precision.

#### Scenario: Official venue coordinates differ from saved history

- **WHEN** the official site explicitly supplies the target Edition's venue coordinates far from a saved point or historical donor
- **AND** supplied evidence gives no concrete reason to reject those coordinates, while geocoding returns only a locality or fails
- **THEN** Location selects the registered official venue point without requiring a confirmed move or lower precision
- **AND** it retains the material unexplained discrepancy in unresolved

#### Scenario: Official coordinates refer to an outdated venue

- **WHEN** supplied evidence establishes that the site's coordinates belong to a venue withdrawn for the target Edition
- **THEN** their official origin does not give them priority over applicable saved data or another supported point

#### Scenario: A new candidate is far from the old point

- **WHEN** a geocoding candidate differs substantially but no supplied evidence supports replacing the old point
- **THEN** distance alone does not replace an otherwise applicable old point
- **AND** the unresolved discrepancy remains visible

#### Scenario: History is inherited by default

- **WHEN** target coordinates are absent and one suitable historical donor exists without contrary evidence
- **THEN** Location can explicitly inherit that point with its saved precision
- **AND** the reason identifies inheritance rather than a freshly verified venue

#### Scenario: The target already has the new venue point

- **WHEN** a move makes the historical donor inapplicable but the saved target point matches the new venue
- **THEN** Location can preserve the target point without inheriting the historical point

### Requirement: Disproved points are not a fallback

Location SHALL NOT preserve or inherit a point that supplied evidence establishes as inapplicable to the target place. This includes a move and an earlier mapping error. If no replacement is supported, it SHALL explicitly clear a disproved saved target point or leave an absent point unset. Query failure or missing information alone SHALL NOT authorize a clear.

#### Scenario: A confirmed move has no resolved point

- **WHEN** evidence establishes a new venue and the target's saved point belongs to the old venue
- **AND** no supported venue point or applicable locality fallback is found
- **THEN** the new venue can be accepted while the disproved target point is explicitly cleared
- **AND** the missing new point remains unresolved

#### Scenario: The target has no point and its donor is disproved

- **WHEN** the target has no saved point, its historical donor is inapplicable, and no supported replacement exists
- **THEN** Location returns keep with the reason for not inheriting and an unresolved coordinate question
- **AND** the target stays without coordinates; clear is invalid because it has no saved point to remove

#### Scenario: Geocoding fails without contrary evidence

- **WHEN** a query fails and the saved point has not been disproved
- **THEN** the failure alone does not clear that point

### Requirement: Place context controls candidate quality

Location SHALL assess candidate type, address, locality, and venue meaning with the supplied context. A locality or region result SHALL NOT be treated as a specific venue. Open-air format, distance, name overlap, provider ordering, and confidence SHALL NOT alone prove or disprove a point. An unsuccessful refinement SHALL retain the true precision of any preserved point.

#### Scenario: A central park hosts an open-air festival

- **WHEN** source evidence establishes a park in the city centre as the venue
- **THEN** open-air format does not disqualify the park because of its central position

#### Scenario: The result is the city centre

- **WHEN** a specific venue is known but the geocoder returns only a locality point
- **THEN** that point is not reported as a resolved venue
- **AND** it does not displace an applicable venue point solely because it is new

#### Scenario: A bridge shares the venue name

- **WHEN** a bridge and a fairground share words in their names
- **THEN** name overlap alone does not establish the bridge as the festival venue

### Requirement: An applicable city point is a fallback

When no better applicable point is available, Location SHALL allow a supported locality point even when a specific venue is named. It SHALL store locality precision and retain the unresolved venue question. A newer locality result SHALL NOT displace an applicable specific saved point. The locality SHALL apply to the target Edition; unrelated towns SHALL NOT justify an arbitrary fallback.

#### Scenario: A known venue has only a city candidate

- **WHEN** no applicable saved or donor point exists and the only supported candidate is the Edition's city
- **THEN** Location can select that candidate with locality precision so the Edition can appear on the map
- **AND** the venue point remains unresolved

#### Scenario: Venue queries return unsuitable objects

- **WHEN** no applicable saved, donor, source, or venue candidate point exists, the locality is established, and geocoding calls remain
- **THEN** Location queries the locality with its administrative area and country without the venue name before leaving coordinates absent
- **AND** it does not repeat an equivalent completed query or exceed the existing call limit
- **AND** only a supported locality result can provide the fallback

#### Scenario: The old venue point remains applicable

- **WHEN** an applicable specific saved point exists and forward geocoding returns only the city
- **THEN** Location preserves the specific point rather than replacing it with the city fallback

### Requirement: Several venues do not imply an arbitrary point

For an Edition with several venues, Location SHALL select one point only when supplied evidence establishes a suitable primary venue or representative point. It SHALL NOT compute a centre or choose the venue nearest to history as a substitute for that evidence. Unresolved cases SHALL follow the saved-point applicability policy.

#### Scenario: A festival spans two towns

- **WHEN** evidence names venues in two towns without a primary location
- **THEN** Location does not choose a hotel or average the towns to fabricate one festival point

#### Scenario: Several venues share one locality

- **WHEN** several venues share one supported locality, no primary venue is established, and no applicable saved point exists
- **THEN** Location selects a supported locality point with locality precision and keeps the venue choice unresolved
- **AND** one confirmed show at a venue does not make that venue the representative point of the whole Edition

### Requirement: Geocoding is bounded and independent of old points

Geocoding SHALL return bounded candidates and safe provider failures. Forward requests SHALL use the applicable country constraint and SHALL NOT bias results toward saved coordinates. Provider success SHALL NOT certify a festival venue. A provider failure SHALL NOT authorize invented coordinates or changes to otherwise applicable saved data.

#### Scenario: A saved point is wrong

- **WHEN** ingestion searches for a supplied venue
- **THEN** the saved point is available for comparison but is not sent as proximity bias

#### Scenario: No provider key is configured

- **WHEN** ingestion requests geocoding without a key
- **THEN** the tool returns unavailable without exposing configuration
- **AND** ingestion can still return a supported source-point or preservation decision

### Requirement: Location failure does not apply unreviewed findings

A valid Location plan with unresolved questions SHALL allow unrelated supported changes. A technical failure, invalid final required Location result, explicit rejection, country conflict, or material identity conflict SHALL stop all item writes. The application SHALL NOT substitute raw research or a partial unvalidated Location result. A valid explicit rejection SHALL have a separate rejected status and retain its reason. A malformed final result and technical errors SHALL remain failures.

#### Scenario: A valid result cannot improve the old point

- **WHEN** Location returns a valid keep decision with an unresolved refinement question
- **THEN** a supported ticket update can still proceed in the same item

#### Scenario: Location returns an explicit rejection

- **WHEN** Location returns a valid rejected decision with a reason
- **THEN** no item changes are prepared or applied
- **AND** Location has rejected status and retains the reason in a location_rejected diagnostic
- **AND** the attempt has failed outcome and the command exits with failure
- **AND** an isolated Location evaluation fails and retains the rejection reason in its diagnostics

#### Scenario: A location action violates a validation rule

- **WHEN** a final Location action fails application validation
- **THEN** the report retains the safe rule failure with location_failed and no writes
- **AND** a schema error retains bounded issue paths and codes without raw exception or provider messages

#### Scenario: Location returns a malformed result

- **WHEN** Location has no valid final output
- **THEN** no editor-only update commits and the failure is reported separately from research success

### Requirement: Inheritance uses a stable historical source

Historical inheritance SHALL identify an earlier Edition and its copied point. The historical donor SHALL NOT be defined solely by the previousEdition role. A tentative point chosen for another slot in the same run SHALL NOT become a privileged donor. The application SHALL recheck an inherited donor's version and point in the write transaction.

#### Scenario: The donor is not an update target

- **WHEN** a historical donor changes after research and before the item write
- **THEN** the whole item is rejected instead of copying a stale point

#### Scenario: Completion order is ambiguous

- **WHEN** the saved chronology cannot establish a suitable unique prior donor
- **THEN** the application does not silently choose one by row order or matching year

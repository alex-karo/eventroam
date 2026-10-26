# Spec Delta

## Purpose

Define automatic, source-backed decisions for an Edition's venue, address, locality, country, and coordinates, with a preference for applicable saved points.

## ADDED Requirements

### Requirement: Location runs only for accepted Edition targets

During ingestion, Location SHALL run after a valid editor decision and before catalog operations are prepared. One assignment SHALL cover all accepted Edition slots of one Event. It SHALL NOT restore declined slots or change Event or Edition identity. Rejected editing, duplicate add, declined Event creation, or no accepted Edition slots SHALL skip Location.

#### Scenario: The editor rejects the festival association

- **WHEN** the editor rejects the research as another festival
- **THEN** Location does not run and no catalog change is made

#### Scenario: Only the next Edition is accepted

- **WHEN** the editor accepts currentOrNextEdition and returns previousEdition as null
- **THEN** Location can act only on the accepted currentOrNextEdition key
- **AND** it can read saved history without changing it

#### Scenario: Both Editions are accepted

- **WHEN** the editor accepts two distinct Edition slots
- **THEN** one Location assignment assesses them with separately keyed decisions
- **AND** neither slot requires a separate earlier Location run

#### Scenario: Editor context is available

- **WHEN** Location receives accepted targets
- **THEN** it also receives relevant saved state, research, and available editor identity and slot decisions with their explanations
- **AND** absent explanations are not invented and editor decisions do not authorize Location to restore a declined slot

### Requirement: Initial geocoding prepares Location context

Before the Location model call, the application SHALL prepare reverse context for the saved target point, or its default donor when absent. It SHALL forward geocode the new Research description, using saved text only when no new description is supplied. Withdrawal SHALL NOT count as an absent finding. It SHALL NOT append an old address to a new venue. Requests without usable inputs SHALL be skipped.

#### Scenario: Research establishes a new venue

- **WHEN** the accepted target has an old point and research supplies a new venue description
- **THEN** Location receives reverse context for the old point and forward candidates for the new description before its model call
- **AND** the forward query does not combine the new venue with the withdrawn address

#### Scenario: Two slots share their location inputs

- **WHEN** accepted slots have identical old coordinates or identical forward text after whitespace normalization with the same country constraint
- **THEN** the application makes one initial request for each distinct direction and input and shares its result between those slots
- **AND** Location assesses applicability separately for each slot

### Requirement: Reverse results provide context only

A reverse result SHALL retain the queried point and bounded nearby place or address context. It SHALL NOT become a selectable replacement point, prove a mapping error, or change precision by itself. Location SHALL NOT assume the returned address contains the queried point. Location SHALL have no reverse geocoding or Place Details tool.

#### Scenario: Reverse geocoding returns a nearby building

- **WHEN** the provider returns a building address with coordinates different from the queried old point
- **THEN** Location can use it as nearby context without treating the old point as that building
- **AND** the returned pair is not registered as a selectable coordinate candidate

### Requirement: Location owns a coherent place description

During ingestion, Location SHALL own venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates. Each accepted slot SHALL contain explicit decisions for these fields. It SHALL assess them together using supplied findings, Edition-specific sources, and saved context. The editor SHALL NOT return location actions. Location SHALL NOT change other fields.

#### Scenario: A new venue has an old address

- **WHEN** sources establish a new venue and show that the saved address belongs to the old venue
- **THEN** Location does not keep that address as if it belonged to the new venue
- **AND** it explicitly clears the disproved address or supplies a supported replacement

#### Scenario: Location data is incomplete but not disproved

- **WHEN** a field has no supported replacement or evidence against its saved value
- **THEN** Location returns an explicit keep action without claiming fresh verification

#### Scenario: A text action is missing

- **WHEN** a ready Location slot omits a decision for a location text field
- **THEN** validation rejects the whole item before writes

#### Scenario: Plans overlap in field ownership

- **WHEN** the editor supplies a location action or Location supplies a non-location action
- **THEN** validation rejects the whole item before writes

### Requirement: Location decisions retain their evidence

Each changed or cleared location field SHALL have a reason tied to its Edition. Source-backed decisions SHALL cite supplied source references. Geocoding choices SHALL cite registered candidates, and inheritance SHALL cite its donor. Unsupported references SHALL be rejected. Location SHALL use only supplied research and saved context plus its geocoding tool; it SHALL NOT perform another web investigation.

#### Scenario: Only a city is known

- **WHEN** research supplies Lisbon without a supported venue and the geocoder cannot establish one
- **THEN** Location reports the missing venue information without inventing an address or claiming venue precision

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

Location SHALL prefer an applicable saved target point. When target coordinates are absent, it SHALL prefer a suitable historical point unless evidence supports its rejection or a better correction. Keeping target coordinates and inheriting history SHALL be distinct actions. Preserving or inheriting a point SHALL NOT imply fresh verification or improved precision.

#### Scenario: A new candidate is far from the old point

- **WHEN** the candidate differs substantially but no evidence establishes which point is wrong
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

#### Scenario: The old venue point remains applicable

- **WHEN** an applicable specific saved point exists and forward geocoding returns only the city
- **THEN** Location preserves the specific point rather than replacing it with the city fallback

### Requirement: Several venues do not imply an arbitrary point

For an Edition with several venues, Location SHALL select one point only when supplied evidence establishes a suitable primary venue or representative point. It SHALL NOT compute a centre or choose the venue nearest to history as a substitute for that evidence. Unresolved cases SHALL follow the saved-point applicability policy.

#### Scenario: A festival spans two towns

- **WHEN** evidence names venues in two towns without a primary location
- **THEN** Location does not choose a hotel or average the towns to fabricate one festival point

### Requirement: Geocoding is bounded and independent of old points

Forward geocoding SHALL return bounded candidates and safe provider failures. Forward requests SHALL use the applicable country constraint and SHALL NOT bias results toward saved coordinates. The agent's only tool SHALL be forward geocode for useful refinements or alternate spellings when prepared results are unsuitable. Location SHALL have no page, web search, or write tool. Provider success SHALL NOT certify that a candidate is the festival venue.

#### Scenario: A saved point is wrong

- **WHEN** Location searches for a supplied venue
- **THEN** the saved point is available for comparison but is not sent as proximity bias

#### Scenario: No provider key is configured

- **WHEN** Location requests geocoding without a key
- **THEN** the tool returns unavailable without exposing configuration
- **AND** Location can still return a supported source-point or preservation decision

### Requirement: Location failure does not apply unreviewed findings

A valid Location plan with unresolved questions SHALL allow unrelated supported changes. A failed or invalid required Location result, explicit rejection, country conflict, or material identity conflict SHALL stop all item writes. The application SHALL NOT substitute raw research or a partial unvalidated Location result.

#### Scenario: A valid result cannot improve the old point

- **WHEN** Location returns a valid keep decision with an unresolved refinement question
- **THEN** a supported ticket update can still proceed in the same item

#### Scenario: Location returns a malformed result

- **WHEN** Location output cannot be validated
- **THEN** no editor-only update commits and the failure is reported separately from research success

### Requirement: Inheritance uses a stable historical source

Historical inheritance SHALL identify an earlier Edition and its copied point. The historical donor SHALL NOT be defined solely by the previousEdition role. A tentative point chosen for another slot in the same run SHALL NOT become a privileged donor. The application SHALL recheck an inherited donor's version and point in the write transaction.

#### Scenario: The donor is not an update target

- **WHEN** a historical donor changes after research and before the item write
- **THEN** the whole item is rejected instead of copying a stale point

#### Scenario: Completion order is ambiguous

- **WHEN** the saved chronology cannot establish a suitable unique prior donor
- **THEN** the application does not silently choose one by row order or matching year

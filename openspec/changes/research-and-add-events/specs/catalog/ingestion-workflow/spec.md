## MODIFIED Requirements

### Requirement: Local commands target Events
The CLI SHALL accept one nonblank free-text description through `--input` for `add` and one or more Event IDs for `refresh`. Refresh SHALL accept `--scope full|current` and default to `full`. Add SHALL NOT accept a scope. `check`, operator labels, and Edition targets SHALL be rejected before research. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

#### Scenario: Several Events are refreshed
- **WHEN** the owner refreshes several distinct Event IDs
- **THEN** each Event is researched and committed independently with its assigned Editions
- **AND** one failed Event does not stop the others, but makes the command exit nonzero

#### Scenario: Unsupported input
- **WHEN** the owner supplies `check`, an invalid scope, a scope for add, an operator flag, or an Edition target
- **THEN** the command rejects the input before research and makes no catalog changes

#### Scenario: Add without a name
- **WHEN** the owner supplies a link, coordinates, or a multiline note about one possible Event
- **THEN** the CLI accepts the text without requiring a name
- **AND** blank input and the replaced `--name` flag fail before research

### Requirement: Studio starts with a bounded preview

The local or hosted Studio workflow form SHALL accept add with one nonblank free-text `input` and one Event target per refresh, with the CLI's scope behavior. Studio chat SHALL also accept an owner-requested selection for add or refresh under the studio-assistant contract. Each selected Event SHALL use a separate full workflow execution. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions. Cancellation SHALL preserve known commits and safe failure details without requiring report usage totals.

#### Scenario: Studio preview and apply

- **WHEN** the owner runs the same valid target in Studio preview and then apply
- **THEN** preview retains no catalog changes and apply uses a new attempt against current state

#### Scenario: Invalid Studio target

- **WHEN** Studio receives an unsupported mode, target, or scope
- **THEN** it rejects the request before research and makes no catalog changes

#### Scenario: An active Studio run is cancelled

- **WHEN** the owner cancels a started Studio run
- **THEN** subsequent catalog writes stop, known commits remain, and the run attempts failed finalization without replaying work
- **AND** available usage metrics remain in optional observability

#### Scenario: Owner starts refresh through chat

- **WHEN** the owner requests refresh of a valid bounded selection in Studio chat
- **THEN** each Event uses the same workflow validation, preview or apply behavior, and durable attempt lifecycle as the form
- **AND** chat does not resume or replay saved ingestion plans

#### Scenario: Studio add input
- **WHEN** the owner submits add with a URL as its only input
- **THEN** the form starts the same add workflow as the CLI
- **AND** omission of input or use of only the former name field fails before research

## ADDED Requirements

### Requirement: Add input guides source collection
Add SHALL treat all supplied information as search leads. It SHALL use relevant links and other clues to identify the Event and inspect sources. It SHALL require independent evidence for catalog facts. Text in a note, a search result, or a candidate page SHALL NOT authorize further jobs or a change of mode.

#### Scenario: A note contains a tentative name and date
- **WHEN** an inspected organizer page establishes a different date for the identified Event
- **THEN** the workflow uses the supported date and does not copy the tentative date

#### Scenario: A link identifies a duplicate
- **WHEN** inspected evidence confirms that the linked festival already exists in the catalog
- **THEN** add skips it and reports the existing Event ID without changing the Event

#### Scenario: Clues fit two festivals
- **WHEN** the workflow cannot establish which Event the note describes
- **THEN** it reports the unresolved identity and creates no Event

#### Scenario: A map page repeats the supplied pin
- **WHEN** the owner supplies a pin and the map page or reverse lookup only repeats its coordinates or names the surrounding city
- **THEN** add treats the pin as a lead and leaves coordinates empty if no independent source establishes an applicable place
- **AND** if another source establishes only the Edition's city, an available city point can be used with `locality` precision under the existing Location rules

### Requirement: Add preserves the full research note
CLI add, the Studio form, and queued add jobs SHALL accept multiline notes beyond the former 500-character name limit. Each accepted job and started attempt SHALL retain the full note in private input. The collector SHALL receive the full note. If the complete input cannot be processed, ingestion SHALL report the failure without silently truncating the note or applying changes from a partial note.

#### Scenario: A long note ends with an organizer link
- **WHEN** a note longer than 500 characters has an organizer link on its last line
- **THEN** the saved input and the collector's assignment include the last line and the original line breaks

### Requirement: A verified place can establish its country
When an independent source establishes the Edition's place and Location selects a matching forward geocoding candidate, ingestion SHALL set an absent countryCode from that candidate's assigned country. The candidate SHALL agree with the place evidence and any saved country baseline. A query country filter alone SHALL NOT establish the country.

#### Scenario: A confirmed city has a country in geocoding
- **WHEN** an independent source places the Edition in Wacken and the selected matching city candidate has country DE
- **AND** the target has no country and there is no saved-country conflict
- **THEN** ingestion sets countryCode to DE with the place evidence and selected candidate as support
- **AND** the venue can remain unresolved and the point retains locality precision

#### Scenario: Geocoding finds a city without festival place evidence
- **WHEN** a note or pin leads to a city candidate but no independent source links the Edition to that place
- **THEN** the candidate does not establish the Edition's country or location

#### Scenario: A candidate conflicts with the saved country
- **WHEN** a selected candidate's country conflicts with the same Event's saved country baseline
- **THEN** ingestion rejects the location decision under the existing country-conflict rule

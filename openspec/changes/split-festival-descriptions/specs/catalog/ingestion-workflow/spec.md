## MODIFIED Requirements

### Requirement: Addition researches an Event and its relevant Editions

Add MUST research the Event identity, both Event descriptions, shared links, and the same two Edition roles as full refresh.
It MUST return the latest completed Edition and the ongoing or nearest announced future Edition where supported by inspected evidence.
It MUST keep their facts separate.
Missing descriptions MUST NOT block Event creation or eligible publication.
An unannounced Edition MUST NOT be inferred from prior facts.

#### Scenario: History and next announcement are available

- **WHEN** inspected sources document a completed Edition and the next announced Edition
- **THEN** the run reports them in `previousEdition` and `currentOrNextEdition` under the matched Event
- **AND** descriptions use the latest known format with announced changes and omit festival history

#### Scenario: A supported Event has no description

- **WHEN** add establishes a new Event and valid publication facts without an Event description
- **THEN** an eligible apply run may create and publish the records without that description

#### Scenario: No next announcement is found

- **WHEN** relevant source checks support a completed Edition but no ongoing or next announced Edition
- **THEN** the run retains the supported history and returns `currentOrNextEdition:null` without creating a forecast Edition
- **AND** this completed absence check alone does not make research partial

#### Scenario: A festival is underway

- **WHEN** inspected evidence supports an ongoing Edition and a later announced Edition
- **THEN** add uses the ongoing Edition in `currentOrNextEdition`
- **AND** it does not also create the later Edition

#### Scenario: Both roles require new records

- **WHEN** a new Event and its two selected Editions are supported
- **THEN** an eligible apply run can create all three records atomically
- **AND** a duplicate Event still causes an identity-only skip without editing or writes

## ADDED Requirements

### Requirement: Ingestion requires information about an Edition

Ingestion MUST require either a selected Edition or a saved Edition with `scheduled` or `announced` status. An explicitly announced Edition can be selected without complete dates. If neither condition holds, the run MUST end without catalog or publication writes and save a report that states the reason. Existing duplicate-add skips MUST remain unchanged.

#### Scenario: No Edition qualifies

- **WHEN** an add or refresh run finds an Event identity but selects no Edition and has no qualifying saved Edition
- **THEN** it ends without catalog or publication changes
- **AND** the run report states that there is insufficient information about editions

#### Scenario: A specific announcement has no complete dates

- **WHEN** ingestion selects a specific festival Edition that sources explicitly announce without complete dates
- **THEN** the selected Edition satisfies the gate
- **AND** ordinary target selection and publication rules still apply

#### Scenario: Only annual recurrence is stated

- **WHEN** sources say the festival takes place every year but establish no specific Edition and there is no qualifying saved Edition
- **THEN** the run stops with the insufficient-information reason
- **AND** it does not infer an Edition from recurrence

#### Scenario: A saved Edition is sufficient

- **WHEN** there is a saved Edition with `scheduled` or `announced` status but no Edition is selected
- **THEN** the Edition gate passes
- **AND** the selected refresh scope still controls research and writes

### Requirement: Descriptions give a fair picture of the current festival

On add and full refresh, ingestion MUST write both English Event descriptions when the material supports useful text. Each text MUST give a broadly accurate impression. It MAY describe atmosphere based on music, setting, activities and participation. It MUST avoid invented experiences and unsupported promises about services or conditions.

#### Scenario: Two Editions are selected

- **WHEN** add or full refresh selects a completed Edition and a current or next Edition
- **THEN** the run can propose one detailed and one short description for the Event as a whole

#### Scenario: The sources describe the setting and activities

- **WHEN** the organizer describes outdoor stages and workshops run by participants
- **THEN** the descriptions can convey music in the open air and a hands-on atmosphere
- **AND** it omits invented amenities, sales claims and keyword lists

#### Scenario: Only the format is known

- **WHEN** the available material establishes only that this is an outdoor music festival
- **THEN** a brief description of that format is sufficient
- **AND** the run can leave a field empty when the material does not support useful text

#### Scenario: A minor detail has indirect support

- **WHEN** a proposed text gives a broadly accurate picture of the current festival and a minor detail has only indirect support
- **THEN** Editor accepts the text if the detail does not mislead readers or make an unsupported promise

### Requirement: Festival descriptions keep their Event scope

Both texts MUST describe the festival in its current form. The latest known format MUST remain the basis unless sources report a change. Announced changes MUST apply before the new Edition takes place. Both texts MUST omit history and Edition-specific details such as dates, lineups, ticket prices and directions. This continuity rule MUST NOT change the rules for reusing Edition categories.

#### Scenario: A festival changes its character

- **WHEN** the current organizer material describes an electronic music festival and an archive describes its earlier rock programme
- **THEN** the descriptions reflect the electronic music festival and omit the earlier programme

#### Scenario: A feature belongs to one Edition

- **WHEN** an announcement explicitly describes a temporary host city and a jazz stage for this Edition only
- **THEN** neither description presents the city as the festival's regular home or jazz as its usual focus

#### Scenario: The latest known format remains useful

- **WHEN** material from the latest known Edition describes camping, workshops and night-time dancing and no source reports a change
- **THEN** the descriptions can use those features without fresh confirmation for a later Edition
- **AND** they do not promise free camping or an uninterrupted programme without support
- **AND** category reuse still needs the evidence required by its own rules

#### Scenario: A move is announced before the next Edition

- **WHEN** the festival announces that its next Edition moves from a forest to an urban setting
- **THEN** both descriptions use the announced urban setting before that Edition takes place
- **AND** neither text presents the former forest setting as current

#### Scenario: An attendance estimate includes volunteers

- **WHEN** the run proposes an Edition size estimate from a past count that includes volunteers
- **THEN** the reason for the estimate records the year and who was counted
- **AND** both Event descriptions omit that Edition count and its qualifications

### Requirement: Each description can stand on its own

The detailed text MUST help a reader picture the festival through its format and distinctive features where known. The short text MUST identify the festival by name and format in one or two complete sentences suitable for a preview. Either text MAY highlight a different aspect of the current festival. Ingestion MUST assess each field independently.

#### Scenario: Two texts emphasize different features

- **WHEN** current material describes outdoor music and workshops run by participants
- **THEN** the detailed text can focus on the music and setting while the short text highlights participation
- **AND** a detail can appear in just one text

#### Scenario: Only one change is accepted

- **WHEN** Editor accepts a revision to either field and rejects the other revision
- **THEN** ingestion can apply the accepted revision on its own

# Ingestion workflow

## Purpose

Define how an owner starts catalog ingestion through the CLI or Studio, previews or applies its result, and resumes work after interruption.

## Requirements

### Requirement: Ingestion is owner initiated
Discovery, source checks, additions, and refreshes SHALL run only when the owner starts a local CLI, loopback Studio, or hosted Studio operation. The catalog SHALL NOT refresh itself on a schedule or require a hosted ingestion service.

#### Scenario: No owner starts a run
- **WHEN** no owner starts an ingestion operation
- **THEN** the catalog does not discover or refresh records autonomously

#### Scenario: Owner starts a run
- **WHEN** the owner starts ingestion through the CLI or loopback Studio
- **THEN** the operation can complete without a deployed collection server

#### Scenario: Owner starts hosted ingestion
- **WHEN** the owner starts an ingestion operation through hosted Studio
- **THEN** it uses the configured server catalog and the same validated workflow as local ingestion
- **AND** the operation starts only from that explicit request

### Requirement: Local commands target Events
The CLI SHALL use the running local Studio workflow and its configured catalog, provider, and limits. The CLI SHALL accept one nonblank free-text description through `--input` for `add` and one or more Event IDs for `refresh`. Refresh SHALL accept `--scope full|current` and default to `full`. Add SHALL NOT accept a scope. `check`, operator labels, and Edition targets SHALL be rejected before research. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

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

#### Scenario: Studio is unavailable

- **WHEN** the command cannot reach Studio
- **THEN** it exits nonzero and tells the owner to check Studio
- **AND** it starts no local ingestion process

#### Scenario: A start response is lost

- **WHEN** the connection drops after the command sends a workflow start request
- **THEN** the command reports an unknown outcome with the workflow execution ID and does not start that item again

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

### Requirement: Add creates a supported new Event or skips
Add SHALL create a new Event only when its identity and creation are supported. A recognized duplicate SHALL report `skipped` with the existing Event ID. A decision to decline new Event creation SHALL also report `skipped` with its reason. Neither skip SHALL make catalog or publication changes. Updating an existing Event SHALL require a targeted refresh.

#### Scenario: A duplicate suggests changed facts
- **WHEN** add identifies an existing Event and finds different dates, links, or tickets
- **THEN** it reports the existing ID and makes no changes

#### Scenario: A new festival is supported
- **WHEN** add establishes a new Event identity and valid Edition facts
- **THEN** an eligible apply run creates the Event and supported Editions atomically

#### Scenario: New Event creation is declined
- **WHEN** research is usable but the update decision finds insufficient grounds to create the Event
- **THEN** add reports skipped with an explanation and makes no catalog or publication changes

### Requirement: Refresh checks an existing Event
Refresh SHALL target only the requested Event. Its research instructions SHALL follow the selected [refresh scope](../refresh-scope/spec.md). They SHALL request checks for factual corrections and updates, including known links where assigned. A page wording change alone SHALL NOT create a catalog change. Unknown or mismatched target IDs SHALL fail before research.

#### Scenario: A known page changes without a fact change
- **WHEN** a source changes wording but supports the saved catalog facts
- **THEN** refresh reports no catalog change and creates no duplicate audit entry

#### Scenario: A venue correction is supported
- **WHEN** an in-scope Edition's venue has changed and the update passes ingestion and catalog guards
- **THEN** refresh updates that Edition while preserving sibling Editions

### Requirement: Debug previews show changes without catalog writes
The owner SHALL be able to start a preview from the CLI or Studio and inspect proposed catalog changes and their old and new values in Studio. A preview SHALL retain no catalog record, version, audit, or receipt changes. Its ingestion run and final report SHALL remain available, including any transient new identifiers.

#### Scenario: Preview a correction
- **WHEN** the owner previews an Edition venue correction
- **THEN** the report shows the proposed change and reason while catalog state and audit history remain unchanged

#### Scenario: Preview a new Event
- **WHEN** the owner previews adding an Event and Editions
- **THEN** the final report retains the proposed changes even though no new catalog identities persist

### Requirement: Eligible apply runs publish
An apply run SHALL submit valid, in-scope changes to atomic catalog write and publication operations. It SHALL publish eligible addressed records without a separate review queue, subject to the publication gates and withdrawn-record rules in the publication spec.

#### Scenario: A complete new festival
- **WHEN** an apply run supplies valid changes and publication facts for a new Event and Edition
- **THEN** it publishes them and reports their stable identifiers

#### Scenario: Preserved content becomes publishable
- **WHEN** an addressed draft Edition becomes eligible while its content fields are kept
- **THEN** apply publishes it without changing those fields

#### Scenario: Withdrawn content is addressed without republish permission
- **WHEN** an apply run addresses a withdrawn Edition but republish permission is absent
- **THEN** the Edition remains withdrawn even if its saved facts pass publication gates

### Requirement: Interrupted work restarts from current catalog state
After interruption, a new owner-initiated attempt SHALL reload current catalog state and research again. Committed changes SHALL remain, incomplete item transactions SHALL roll back, and the new attempt SHALL have its own run ID. It SHALL NOT replay a saved plan or infer that an unfinished earlier attempt succeeded.

#### Scenario: One item committed before interruption
- **WHEN** an attempt stops after committing one Event and the owner starts another attempt
- **THEN** the new attempt uses the current catalog state without duplicating the committed Event

#### Scenario: Process stops after an item commit
- **WHEN** the process stops before finalizing its ingestion run
- **THEN** the committed catalog changes remain and the earlier run has no claimed final result

### Requirement: Provider unavailability has bounded recovery

Ordinary research SHALL make bounded recovery attempts only for explicit provider unavailability within the run deadline. It SHALL retain completed work without duplicating catalog writes. Available usage metrics SHALL follow the optional observability contract rather than separate report accounting. Other model failures SHALL NOT trigger automatic retries.

#### Scenario: A provider is temporarily unavailable

- **WHEN** the model provider explicitly reports unavailability while research has time remaining
- **THEN** the run retries within its budget while retaining completed work
- **AND** available model-call metrics remain in optional observability

#### Scenario: A different model failure occurs

- **WHEN** the provider fails for another reason
- **THEN** the run reports a safe model failure without retrying that failure automatically

### Requirement: Studio starts with a bounded preview

The Studio workflow SHALL accept an explicit `mode` and a matching `input`. Add input SHALL be one nonblank note. Refresh input SHALL contain one `eventId` and an optional `scope` that defaults to full. Studio chat SHALL also accept an owner-requested selection for add or refresh under the studio-assistant contract. Each selected Event SHALL use a separate full workflow execution. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions. Cancellation SHALL preserve known commits and safe failure details without requiring report usage totals.

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

#### Scenario: The official festival name contains Open Air

- **WHEN** inspected evidence confirms the current official festival name contains `Open Air` and no direct evidence contradicts the setting
- **THEN** both descriptions can describe the main programme as open-air
- **AND** direct evidence about the current setting takes priority over the name

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

Ingestion MUST request three to five sentences for the detailed text and one or two sentences for the short text. Both texts MUST omit the festival name. The detailed text MUST help a reader picture the current festival through its format and distinctive features where known. The short text MUST summarize the current format for a preview. Either text MAY highlight a different aspect of the current festival. Ingestion MUST assess each field independently.

#### Scenario: Two texts emphasize different features

- **WHEN** current material describes outdoor music and workshops run by participants
- **THEN** the detailed text can focus on the music and setting while the short text highlights participation
- **AND** a detail can appear in just one text

#### Scenario: Only one change is accepted

- **WHEN** Editor accepts a revision to either field and rejects the other revision
- **THEN** ingestion can apply the accepted revision on its own

### Requirement: A disputed group can return to its owner once

Editor SHALL be able to return an assigned group or omission to its owner with its note as written. The note MAY contain facts and citations from saved sources. Each group for a selected target SHALL have at most one return per Event attempt. Validation and Editor share that allowance. Ingestion SHALL send one request per owner for all eligible validation returns and one for all eligible Editor returns. Returns SHALL use the attempt's budget and deadline.

#### Scenario: Roskilde ticket terms conflict

- **WHEN** Editor returns the Roskilde ticket group because the saved pages disagree about Smart Ticket instalments but support a DKK 2,650 full pass
- **AND** Editor has accepted an independent link proposal
- **THEN** Tickets receives the request for that group with Editor's note as written, including any passages and source references in the note
- **AND** Tickets can submit a complete supported block that retains the full pass and leaves any unresolved terms open
- **AND** the next review covers only the ticket revision
- **AND** the accepted link proposal stays eligible for the plan

### Requirement: A revision changes only the requested groups

Ingestion SHALL check the revision for an item refusal, a conflict in target, identity or country, and invalid references. A failed or inconclusive check SHALL stop all item writes. If these checks pass, ingestion SHALL assess revised values only for the requested groups. A value error in another group SHALL leave the revision eligible. Ingestion SHALL keep earlier proposals and decisions for all other groups.

#### Scenario: A website repair also mentions the ticket link

- **WHEN** the original Event website URL fails validation but the Edition ticket link is valid
- **AND** Links receives the failed rule for the website and returns a valid website and a ticket link of `bad-url`
- **THEN** the first general review receives the revised website and the ticket link from the first answer
- **AND** only the website has used its return

### Requirement: Editor decides each returned group once

Editor SHALL give each valid returned value or omission exactly one decision, either approval or rejection. After a validation return, the first review SHALL include the returned group. After an editorial return, a separate review SHALL cover only the returned groups and include the reason for return and relevant evidence. Approval or rejection of a valid omission SHALL preserve the saved field.

#### Scenario: An editorial return ends in an omission

- **WHEN** Editor returns an Edition's tickets and Tickets omits the optional replacement with a reason
- **THEN** the separate review identifies that Edition's tickets as omitted and requires Editor to accept or reject the omission
- **AND** a rejection records the decision, preserves saved tickets and lets an independent approved link proceed

### Requirement: Validation can return a group before review

After target selection, validation SHALL check the whole original reply even if a field is invalid. If the item checks pass, validation SHALL return each assigned group with a field error that it can link to that group, within the return allowance, budget and deadline. The owner SHALL receive the affected values and failed rules. An error that has no assigned group or has no return available SHALL stop the item before review or writes. A valid omission of an optional group can proceed to review.

#### Scenario: Wacken tickets fail validation before Editor runs

- **WHEN** Tickets returns no offers and no free base price for the selected Wacken Edition, and its saved ticket page lists applicable offers
- **THEN** Tickets receives the empty-list rule with the return
- **AND** Tickets can cite the missed LOUDER-TICKET passage, which lists EUR 364 plus a EUR 2 fee, and submit a valid block for normal review
- **AND** this uses the group's return, so Editor can only accept or reject its result

#### Scenario: The specialist cannot establish a price

- **WHEN** the validator returns the Wacken ticket group and Tickets omits the optional replacement because it cannot confirm a price for that Edition
- **THEN** the first general review shows the omitted ticket group and its reason, and requires Editor to accept or reject it
- **AND** accepting the omission preserves saved tickets, keeps the price question open and leaves the ticket check unfinished

#### Scenario: Tickets repeats the invalid offer block

- **WHEN** Tickets uses the return and again submits an empty offer list without a supported free base price
- **THEN** validation fails the item before Editor review or any catalog or audit write

#### Scenario: Wacken tickets have both a field error and an unknown reference

- **WHEN** the original Tickets answer has an empty offer list without a free base price and cites an unknown evidence ID
- **THEN** the validator reports the invalid reference even though the field check already failed
- **AND** the attempt ends with zero specialist returns and zero catalog or audit writes

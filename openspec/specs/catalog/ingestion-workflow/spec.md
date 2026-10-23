# Ingestion workflow

## Purpose

Define how an owner starts local catalog ingestion, previews or applies its result, and resumes work after interruption.

## Requirements

### Requirement: Ingestion is owner initiated and local
Discovery, source checks, additions, and refreshes SHALL run only when the owner starts a local CLI or loopback Studio operation. The catalog SHALL NOT refresh itself on a schedule or require a hosted ingestion service.

#### Scenario: No owner starts a run
- **WHEN** no owner starts an ingestion operation
- **THEN** the catalog does not discover or refresh records autonomously

#### Scenario: Owner starts a run
- **WHEN** the owner starts ingestion through the CLI or loopback Studio
- **THEN** the operation can complete without a deployed collection server

### Requirement: Local commands target Events
The CLI SHALL accept a festival name for `add` and one or more Event IDs for `refresh`. Refresh SHALL accept `--scope full|current` and default to `full`. Add SHALL NOT accept a scope. `check`, operator labels, and Edition targets SHALL be rejected before research. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

#### Scenario: Several Events are refreshed
- **WHEN** the owner refreshes several distinct Event IDs
- **THEN** each Event is researched and committed independently with its assigned Editions
- **AND** one failed Event does not stop the others, but makes the command exit nonzero

#### Scenario: Unsupported input
- **WHEN** the owner supplies `check`, an invalid scope, a scope for add, an operator flag, or an Edition target
- **THEN** the command rejects the input before research and makes no catalog changes

### Requirement: Addition researches an Event and its relevant Editions
Add SHALL research the festival's identity, its latest completed Edition, and its next announced Edition where supported by inspected sources. It SHALL keep Edition facts separate, collect official links, and produce a short factual English Event description. An unannounced Edition SHALL NOT be inferred from prior-year facts.

#### Scenario: History and next announcement are available
- **WHEN** inspected sources document a completed Edition and the next announced Edition
- **THEN** the run reports their facts separately under the matched Event
- **AND** the description does not present historical facts as current

#### Scenario: No next announcement is found
- **WHEN** relevant source checks support a completed Edition but no next announcement
- **THEN** the run retains the supported history and reports the limitation without creating a forecast Edition

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
Refresh SHALL research only the requested Event and its assigned Editions under the selected scope. It SHALL recheck supported facts for corrections and updates, including known links. A page wording change alone SHALL NOT create a catalog change. Unknown or mismatched target IDs SHALL fail before research.

#### Scenario: A known page changes without a fact change
- **WHEN** a source changes wording but supports the saved catalog facts
- **THEN** refresh reports no catalog change and creates no duplicate audit entry

#### Scenario: A venue correction is supported
- **WHEN** an in-scope Edition's venue has changed and the update passes ingestion and catalog guards
- **THEN** refresh updates that Edition while preserving sibling Editions

### Requirement: Debug previews show changes without catalog writes
For local debugging, the owner SHALL be able to preview proposed catalog changes and their old and new values. A preview SHALL retain no catalog record, version, audit, or receipt changes. Its ingestion run and final report SHALL remain available, including any transient new identifiers.

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
Ordinary research SHALL make bounded recovery attempts only for explicit provider unavailability within the run deadline. It SHALL retain completed work and known usage without duplicating catalog writes or inventing missing accounting. Other model failures SHALL not trigger automatic retries.

#### Scenario: A provider is temporarily unavailable
- **WHEN** the model provider explicitly reports unavailability while research has time remaining
- **THEN** the run retries within its budget while retaining completed work and known usage

#### Scenario: A different model failure occurs
- **WHEN** the provider fails for another reason
- **THEN** the run reports a safe model failure without retrying that failure automatically

### Requirement: Studio starts with a bounded preview
Loopback Studio SHALL accept add by name and one Event target per refresh, with the CLI's scope behavior. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions.

#### Scenario: Studio preview and apply
- **WHEN** the owner runs the same valid target in Studio preview and then apply
- **THEN** preview retains no catalog changes and apply uses a new attempt against current state

#### Scenario: Invalid Studio target
- **WHEN** Studio receives an unsupported mode, target, or scope
- **THEN** it rejects the request before research and makes no catalog changes

#### Scenario: An active Studio run is cancelled
- **WHEN** the owner cancels a started Studio run
- **THEN** subsequent catalog writes stop, known commits and usage remain, and the run attempts failed finalization without replaying work

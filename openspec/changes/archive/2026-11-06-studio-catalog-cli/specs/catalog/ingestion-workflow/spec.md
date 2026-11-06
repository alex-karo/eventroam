## MODIFIED Requirements

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

### Requirement: Debug previews show changes without catalog writes
The owner SHALL be able to start a preview from the CLI or Studio and inspect proposed catalog changes and their old and new values in Studio. A preview SHALL retain no catalog record, version, audit, or receipt changes. Its ingestion run and final report SHALL remain available, including any transient new identifiers.

#### Scenario: Preview a correction
- **WHEN** the owner previews an Edition venue correction
- **THEN** the report shows the proposed change and reason while catalog state and audit history remain unchanged

#### Scenario: Preview a new Event
- **WHEN** the owner previews adding an Event and Editions
- **THEN** the final report retains the proposed changes even though no new catalog identities persist

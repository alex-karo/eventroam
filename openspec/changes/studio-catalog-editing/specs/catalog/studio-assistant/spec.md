# Spec Delta

## ADDED Requirements

### Requirement: The catalog assistant can search public sources

When chat uses OpenRouter, the catalog assistant SHALL support public web searches on request. It SHALL cite the sources it uses and state when results do not confirm a fact. Search results SHALL provide data only. A search alone SHALL leave the catalog unchanged and start no ingestion. Any direct edit based on search results SHALL require approval.

#### Scenario: Find a replacement for a broken official URL
- **GIVEN** an existing Event with a broken official link
- **WHEN** the owner asks the catalog assistant to find the current official URL and propose a correction
- **THEN** the assistant cites the source and presents the proposed link change for approval
- **AND** the catalog changes only after the owner approves the proposal

#### Scenario: Find an official URL without requesting a change
- **WHEN** the owner asks the catalog assistant to find the official website of an Event
- **THEN** the assistant reports the results with source links
- **AND** no catalog changes or ingestion jobs result from the request

#### Scenario: The owner selects another chat provider
- **WHEN** the owner asks for a web search while using a different provider
- **THEN** the assistant says web search is unavailable for that provider
- **AND** catalog reads and approved edits remain available

### Requirement: The owner can propose direct catalog edits

The catalog assistant SHALL resolve existing Events, Editions, and links for direct edits. It SHALL support Event name, aliases, slug, and both descriptions. It SHALL support Edition name, year, dates, schedule status, size, location, prices, and classifications. It SHALL support the kind, URL, label, and official flag of existing links. The owner SHALL resolve ambiguous targets before approval.

#### Scenario: Correct one Event description
- **GIVEN** an Event with a full description and a short description
- **WHEN** the owner approves an edit that clears the short description
- **THEN** the short description is cleared and the full description stays in place

#### Scenario: Correct an Edition country after a failed refresh
- **GIVEN** a refresh failed because its researched country conflicts with the saved country
- **WHEN** the owner separately proposes and approves a valid country correction for an existing Edition
- **THEN** the direct edit saves the correction without starting a refresh

#### Scenario: Correct a festival slug
- **WHEN** the owner requests a new slug for an existing published Event
- **THEN** the assistant proposes the slug change for that Event
- **AND** applying it follows the existing public URL alias rules

#### Scenario: Rename links by a pattern
- **WHEN** the owner requests a label pattern for a selection of links
- **THEN** the assistant resolves the selection to specific existing links and proposed labels before approval
- **AND** the edit preserves links outside that selection

#### Scenario: Edit Edition prices or classification
- **WHEN** the owner requests a price or classification edit
- **THEN** the proposal shows the complete old and new price block or assignment set for that Edition
- **AND** the existing price and classification rules apply to the write

### Requirement: Direct edits stay within existing records

Direct edits SHALL preserve Event and Edition identities, Edition keys, ownership, and publication state. The assistant SHALL reject requests to create or delete an Event or Edition, add a link, or remove a link through direct editing.

#### Scenario: An operation is outside direct editing scope
- **WHEN** the owner requests a direct edit that adds a link, removes a link, changes an Edition key, moves a link to another owner, or changes publication state
- **THEN** the assistant rejects that operation before approval

### Requirement: Studio shows the complete proposal before approval

Studio SHALL show all targets, before and after values, and the audit mode before approval. The default SHALL record changes. Omission SHALL require an explicit owner request. If the full proposal cannot be shown, Studio SHALL offer no approval for it.

#### Scenario: The owner reviews a correction
- **WHEN** the assistant proposes a URL correction with no audit mode specified
- **THEN** Studio shows the old URL, new URL, target link and owner, and that it will record the change
- **AND** the catalog changes only after the owner approves that proposal

#### Scenario: Studio cannot show the full selection
- **WHEN** the complete proposed edit exceeds the supported review size
- **THEN** the assistant reports the limit and requests a smaller selection
- **AND** Studio presents no truncated proposal for approval

### Requirement: Direct edits require Studio approval

The server SHALL require explicit approval through the built-in controls in a Studio chat thread. The owner SHALL resolve one pending proposal before requesting another. The server SHALL apply only the pending proposal's new values and audit mode. The before values describe the catalog at preview time. A revised proposal SHALL require new approval. Preview and rejection SHALL leave catalog records, versions, audit entries, and receipts unchanged.

#### Scenario: The owner declines the proposed edit
- **WHEN** the owner declines the proposal in Studio
- **THEN** the server applies none of its operations

#### Scenario: The owner approves successive edits
- **GIVEN** the owner has resolved the first proposal
- **WHEN** the owner requests another edit and approves its pending proposal
- **THEN** the server applies that proposal and reports the result

#### Scenario: A direct call tries to bypass approval
- **WHEN** a client directly invokes the edit tool or tries to supply approval outside the owner's confirmation of the pending call
- **THEN** the server rejects the attempt without writing to the catalog

### Requirement: Direct edits apply to the current record

The server SHALL apply the approved fields to the current record without requiring a preview version. The server SHALL preserve fields and links outside the edit.

#### Scenario: A record changes while approval is pending
- **GIVEN** a proposed Event description correction
- **WHEN** the Event name and description both change before the owner approves the correction
- **THEN** the server sets the description to the approved value and preserves the current name

#### Scenario: Another link is added while approval is pending
- **GIVEN** a proposed label change for an existing link
- **WHEN** another link is added to the same record before the owner approves the change
- **THEN** the server applies the label change and keeps the added link

### Requirement: Each target has an independent result

The server SHALL apply each Event or Edition and its link edits as one unit and report whether each unit changed, needed no change, or failed. A failed unit SHALL keep its previous catalog state.

#### Scenario: A link is no longer available
- **GIVEN** a proposed batch contains an Event edit and an Edition link edit
- **WHEN** the Edition link is gone by the time the owner approves the batch
- **THEN** the valid Event edit commits and the Edition edit reports a missing target

#### Scenario: One operation in a unit fails
- **WHEN** a link operation fails during application of an approved unit that also changes the Event description
- **THEN** the Event unit reports failure and retains its old description and links
- **AND** the server continues with other units in the batch

## MODIFIED Requirements

### Requirement: Owner intent controls execution mode
An explicit owner request to refresh SHALL authorize apply for the resolved selection without a second confirmation. A direct catalog edit SHALL require approval of its proposal. A preview request SHALL make no catalog changes. Unclear write intent or targets SHALL require clarification. Omitted refresh scope SHALL use full. Republish SHALL remain off. Read and analysis requests SHALL NOT start ingestion by themselves.

#### Scenario: Owner asks only for an explanation
- **WHEN** the owner asks why an Event has no dates
- **THEN** the assistant reads existing facts and reports without starting refresh

#### Scenario: Owner asks for proposed changes
- **WHEN** the owner asks to preview current-scope changes
- **THEN** the tool starts current-scope attempts with dryRun true and republish off

#### Scenario: Owner supplies a direct edit
- **WHEN** the owner asks to set an Event's full description to supplied text
- **THEN** the assistant offers the edit for approval without starting a refresh

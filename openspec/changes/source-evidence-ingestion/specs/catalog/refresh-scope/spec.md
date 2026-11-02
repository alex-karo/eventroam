## MODIFIED Requirements

### Requirement: Full scope assigns saved history and the next candidate

Full refresh MUST check Event summary and shared links, the latest completed Edition, and the ongoing or nearest announced future Edition. It MUST check supported fields for both selected Editions, except historical tickets and ticket links. Other saved Editions MUST remain context for matching, country checks, and supported inheritance. They MUST NOT become audit or update targets. Known unfinished mandatory checks MUST remain visible. Success MUST NOT certify complete checks.

#### Scenario: Full refresh has saved history

- **WHEN** full refresh finds a new future announcement and has several saved historical Editions
- **THEN** it checks Event fields, the latest completed Edition, and the current-or-next candidate
- **AND** unfinished checks of those roles remain visible
- **AND** other saved Editions remain context without mandatory field checks

#### Scenario: Both selected Editions are missing

- **WHEN** inspected sources support a previous and current-or-next Edition absent from saved state
- **THEN** full can create both under the targeted Event
- **AND** the former limit of one new Edition does not apply

#### Scenario: A large saved history remains context

- **WHEN** the Event has more than twenty saved Editions
- **THEN** the saved count alone does not reject the two-slot result
- **AND** no twenty-Edition limit applies to saved context combined with selected new keys
- **AND** existing context and deadline limits still apply without silent truncation

#### Scenario: A farther future Edition already exists

- **WHEN** the nearest and farther future Editions are both saved
- **THEN** full checks only the ongoing or nearest future Edition for the current-or-next role
- **AND** it preserves the farther Edition as context

#### Scenario: Other unsaved history exists

- **WHEN** full completes the Event checks and both Edition-role checks
- **THEN** it does not require discovery of other unsaved historical Editions

#### Scenario: Previous tickets are readable
- **WHEN** full inspects the latest completed Edition and finds its prices or ticket URLs
- **THEN** it does not interpret or propose changes to those ticket fields
- **AND** their omission does not make the assignment partial

### Requirement: Current scope focuses research on one selected Edition

Current refresh MUST check announcement, dates, schedule status, location, tickets, and classification for currentOrNextEdition only. Its previousEdition MUST be null. Size, source coordinates, and detailed address can remain opportunistic. It MUST NOT audit Event fields, history, or the established identity baseline. Only the selected Edition can receive changes or publication evaluation. Ownership, country, and catalog guards MUST apply.

#### Scenario: The next Edition changes venue and programme

- **WHEN** an inspected official announcement supports the same Event name and association, gives the saved country, and announces a different venue, locality or programme for the next Edition
- **THEN** current refresh can continue with that Edition without requesting full refresh solely because of those changes
- **AND** an absent saved locality is not an identity contradiction
- **AND** Event fields remain outside the current assignment and the country guard still applies

#### Scenario: Current refresh has saved history

- **WHEN** current selects one future Edition and another Edition is saved
- **THEN** only the selected Edition can receive findings, changes, or publication evaluation
- **AND** the other Edition remains context for matching, country checks, classification reuse, and earlier saved points

#### Scenario: Current returns an additional Event fact

- **WHEN** current returns an Event summary or shared-link finding, or the prepared update addresses an Event field
- **THEN** the application rejects the item before catalog operations

#### Scenario: No Editions are saved

- **WHEN** the targeted Event has no Editions
- **THEN** full can create up to two supported selected Editions and current can create up to one

#### Scenario: A result exceeds the assignment

- **WHEN** current returns a previous Edition or Event field finding, or a plan addresses a key outside its selected slot
- **THEN** the result is rejected before catalog operations
- **AND** this includes keep-only actions for another saved Edition

#### Scenario: Current encounters Event facts

- **WHEN** current inspects a changed Event description or shared social account
- **THEN** it omits Event summary and shared-link findings
- **AND** it retains the observed name, source summaries, and identity diagnostics

#### Scenario: Optional details are unavailable

- **WHEN** current completes its mandatory checks without size, precise coordinates, or detailed address findings
- **THEN** their omission does not require separate research or partial status

#### Scenario: Tickets for an ongoing Edition
- **WHEN** currentOrNextEdition is ongoing on the frozen local date
- **THEN** its ticket prices, availability, and ticket links remain in scope

#### Scenario: The current-or-next role is empty
- **WHEN** no current-or-next Edition is selected
- **THEN** no historical ticket work is substituted and saved historical tickets remain unchanged

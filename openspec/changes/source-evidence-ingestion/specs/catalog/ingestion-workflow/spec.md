## MODIFIED Requirements

### Requirement: Addition researches an Event and its relevant Editions

Add MUST establish the Event identity and check its summary, shared links, and the two Edition roles used by full refresh. The result MUST keep each Edition's facts separate. Any Event description MUST be short, factual English. A missing description MUST NOT block creation or eligible publication. Ingestion MUST NOT infer an unannounced Edition. Ticket checks MUST follow the current-or-next boundary in refresh scope.

#### Scenario: History and next announcement are available

- **WHEN** inspected sources document a completed Edition and the next announced Edition
- **THEN** the run reports them in `previousEdition` and `currentOrNextEdition` under the matched Event
- **AND** any description does not present historical facts as current

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

#### Scenario: Add sees historical ticket prices
- **WHEN** collection finds ticket information for the previous and current-or-next Editions
- **THEN** only currentOrNextEdition enters ticket interpretation and public ticket-link selection
- **AND** historical ticket material does not create a price or ticket-link proposal

### Requirement: Refresh checks an existing Event

Refresh SHALL target only the requested Event and follow the selected [refresh scope](../refresh-scope/spec.md). It SHALL check factual corrections and updates, including relevant known links. A page wording change alone SHALL NOT create a catalog change. Unknown or mismatched target IDs SHALL fail before external work.

#### Scenario: A known page changes without a fact change
- **WHEN** a source changes wording but supports the saved catalog facts
- **THEN** refresh reports no catalog change and creates no duplicate audit entry

#### Scenario: A venue correction is supported
- **WHEN** an in-scope Edition's venue has changed and the update passes ingestion and catalog guards
- **THEN** refresh updates that Edition while preserving sibling Editions

# Spec Delta

## MODIFIED Requirements

### Requirement: Addition researches an Event and its relevant Editions

Add MUST research the Event identity, summary, shared links, and the same two Edition roles as full refresh.
It MUST return the latest completed Edition and the ongoing or nearest announced future Edition where supported by inspected evidence.
It MUST keep their facts separate. Add instructions MUST request a short factual English Event description.
A missing description MUST NOT block Event creation or eligible publication.
An unannounced Edition MUST NOT be inferred from prior facts.

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

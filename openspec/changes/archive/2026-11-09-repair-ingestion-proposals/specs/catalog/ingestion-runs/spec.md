# Spec Delta

## ADDED Requirements

### Requirement: Reports show how a proposal was repaired

The private report SHALL identify the target and group for each repair. It SHALL show the available original and revised proposals or omissions, who requested the repair, the reason, source passages with references, and the decision and outcome. It SHALL distinguish a recovered issue from a final failure and a proposal from a write. The full specialist conversation SHALL stay out of the report and saved workflow history.

#### Scenario: The owner opens a repaired preview after the attempt ends

- **WHEN** a preview with tracing off repairs a link after Editor returns it to Links and repairs an invalid ticket group after validation returns it to Tickets
- **AND** the owner opens the report in Studio after the process exits
- **THEN** the report shows both repairs with their values, reasons, source passages and final decisions
- **AND** it attributes the ticket return to validation and shows the field error as recovered

#### Scenario: A repaired website shares a check with an unresolved social link

- **WHEN** a full refresh corrects the Event website while a social link in the same check and an unrelated source gap remain open
- **THEN** the report shows the website correction and keeps the broader check unfinished
- **AND** the social link question and source gap remain visible

#### Scenario: Repair stops before there is a final answer

- **WHEN** a requested revision fails before a valid reply or before final review
- **THEN** the report retains the available original proposal, request and failure
- **AND** it does not claim approval or a catalog write

## MODIFIED Requirements

### Requirement: Failure codes identify the failed boundary

Reports SHALL distinguish model_failed, invalid_candidate, and limit_reached with the failed boundary and safe diagnostics. Budget exhaustion SHALL take precedence when a model failure occurs at the limit. Existing place-check diagnostics SHALL remain available. Required source-storage failures SHALL have a safe persistence diagnostic. Missing details SHALL NOT be invented.

#### Scenario: Provider fails before a candidate

- **WHEN** a model request fails without a usable final result and the research budget is not exhausted
- **THEN** the run reports `model_failed` with available safe error details

#### Scenario: Returned candidate is malformed

- **WHEN** a source URL is malformed or the final candidate still contains a malformed official-link URL after any permitted return
- **THEN** the run reports `invalid_candidate`, retains the returned result and source-read history privately, and makes no catalog changes

#### Scenario: Research budget is exhausted

- **WHEN** research reaches its step or time limit without a valid result
- **THEN** the run reports `limit_reached` with a limit reason, source-read history, and available model questions
- **AND** it does not require or invent a complete list of unfinished checks

#### Scenario: A required result has an invalid reference

- **WHEN** a proposed ticket price cites an evidence reference that does not exist
- **THEN** the report identifies the validation failure and no item changes are applied
- **AND** valid earlier responses remain available for inspection

### Requirement: Classification count errors identify the conflict

If a classification list still has excess facet terms after its permitted return, preparation MUST report `code:invalid_plan`, `stage:validation`, and the classification field path. Its message MUST identify the facet, limit, and conflicting IDs. The item MUST have no catalog operations. A recovered count error MUST appear in the repair record without appearing as a final error.

#### Scenario: An accepted classification has two event types

- **WHEN** Classification uses its return and still proposes both `festival` and `gathering`
- **THEN** the error identifies the Edition slot's classification field, `event_type`, a limit of one, and both term IDs

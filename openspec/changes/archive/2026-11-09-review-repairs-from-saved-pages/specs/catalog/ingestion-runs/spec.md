## MODIFIED Requirements

### Requirement: Reports show how a proposal was repaired

The private report SHALL identify the target and group for each repair. It SHALL show the available original and revised proposals or omissions, who requested the repair, the return note with any source excerpts and references, any existing evidence the revision cites, and the decision and outcome. It SHALL distinguish a recovered issue from a final failure and a proposal from a write. The full specialist conversation SHALL stay out of the report and saved workflow history.

#### Scenario: The owner opens a repaired preview after the attempt ends

- **WHEN** a preview with tracing off repairs a link after Editor returns it to Links and repairs an invalid ticket group after validation returns it to Tickets
- **AND** the owner opens the report in Studio after the process exits
- **THEN** the report shows both repairs with their values, return notes, any available source excerpts, and final decisions
- **AND** it attributes the ticket return to validation and shows the field error as recovered

#### Scenario: A repaired website shares a check with an unresolved social link

- **WHEN** a full refresh corrects the Event website while a social link in the same check and an unrelated source gap remain open
- **THEN** the report shows the website correction and keeps the broader check unfinished
- **AND** the social link question and source gap remain visible

#### Scenario: Repair stops before there is a final answer

- **WHEN** a requested revision fails before a valid reply or before final review
- **THEN** the report retains the available original proposal, request and failure
- **AND** it does not claim approval or a catalog write

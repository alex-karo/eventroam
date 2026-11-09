## ADDED Requirements

### Requirement: Editor can correct an invalid decision list

When a completed Editor reply fails validation, ingestion SHALL allow one correction call for that review. The request SHALL state the failed rules and keep the same review paths and allowed decisions. A correction SHALL use the shared run deadline. If it fails validation, ingestion SHALL stop before catalog writes.

#### Scenario: Editor omits a required decision

- **WHEN** Editor returns a decision list without a required path
- **THEN** Editor receives a correction request that names that path
- **AND** a valid second reply can complete the same review

#### Scenario: Editor repeats an invalid decision

- **WHEN** the Editor correction still contains a disallowed action
- **THEN** ingestion records the validation error and stops before catalog writes

### Requirement: Classification can correct unknown values in an assigned group

When Classification proposes an unknown term or reuse Edition in an assigned group, validation SHALL return that group before Editor if the item checks pass and the group can return. The request SHALL identify the unknown value and explain how to choose an allowed value or omit the optional group.

#### Scenario: Classification names an unknown reuse Edition

- **WHEN** Classification uses an Edition key absent from the saved Event
- **THEN** the return identifies that key and asks Classification to use an applicable earlier saved Edition or omit reuse
- **AND** Editor receives the group after it passes validation

## MODIFIED Requirements

### Requirement: A revision changes only the requested groups

Ingestion SHALL check the revision for an item refusal, a conflict in target, identity or country, and invalid evidence, source or point references. A failed or inconclusive check SHALL stop all item writes. If these checks pass, ingestion SHALL assess revised values only for the requested groups. A value error in another group SHALL leave the revision eligible. Ingestion SHALL keep earlier proposals and decisions for all other groups.

#### Scenario: A website repair also mentions the ticket link

- **WHEN** the original Event website URL fails validation but the Edition ticket link is valid
- **AND** Links receives the failed rule for the website and returns a valid website and a ticket link of `bad-url`
- **THEN** the first general review receives the revised website and the ticket link from the first answer
- **AND** only the website has used its return

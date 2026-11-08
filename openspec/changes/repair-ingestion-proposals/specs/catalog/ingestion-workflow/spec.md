# Spec Delta

## ADDED Requirements

### Requirement: A disputed group can return to its owner within a limit

Editor SHALL be able to return an assigned group or omission to its owner with its note as written. The note MAY contain facts and citations from saved sources. Each group for a selected target SHALL have at most three returns per Event attempt. Validation can use one of these returns before review. Editor can use the remaining returns. Ingestion SHALL send one request per owner with all eligible groups in each round. Returns SHALL use the attempt's budget and deadline.

Editor SHALL check assigned groups for unsupported claims and concrete gaps, including eligible omissions. If the supplied evidence leaves a specific issue open, Editor SHALL search a relevant saved page when the result can change an allowed decision. When the evidence supports a correction or fills a gap and the group can return, Editor SHALL return it with the source and an exact excerpt. If the search is inconclusive, Editor SHALL leave the question open and judge submitted values on their evidence.

#### Scenario: The saved page answers a question about an omitted value

- **WHEN** a specialist leaves a concrete question about an omitted value in its assignment
- **AND** a relevant saved page contains the answer and the group can return
- **THEN** Editor searches the saved page for the answer
- **AND** the group owner receives the source and exact excerpt in the return note

#### Scenario: Roskilde tickets include a payment plan

- **WHEN** Editor returns the Roskilde ticket group because the proposal includes Smart Ticket instalments and the saved pages support a DKK 2,650 full pass
- **AND** Editor has accepted an independent link proposal
- **THEN** Tickets receives the request for that group with Editor's note as written, including any passages and source references in the note
- **AND** Tickets can submit a complete supported block that retains the full pass and excludes the payment plan
- **AND** the next review covers only the ticket revision
- **AND** the accepted link proposal stays eligible for the plan

### Requirement: A revision changes only the requested groups

Ingestion SHALL check the revision for an item refusal, a conflict in target, identity or country, and invalid references. A failed or inconclusive check SHALL stop all item writes. If these checks pass, ingestion SHALL assess revised values only for the requested groups. A value error in another group SHALL leave the revision eligible. Ingestion SHALL keep earlier proposals and decisions for all other groups.

#### Scenario: A website repair also mentions the ticket link

- **WHEN** the original Event website URL fails validation but the Edition ticket link is valid
- **AND** Links receives the failed rule for the website and returns a valid website and a ticket link of `bad-url`
- **THEN** the first general review receives the revised website and the ticket link from the first answer
- **AND** only the website has used its return

### Requirement: Editor reviews the result of each return

Editor SHALL decide each valid revision or omission. After a validation return, the first review SHALL include the returned group. After each editorial return, a separate review SHALL cover only the returned groups and include the reason for return and relevant evidence. Editor can return a group again when it has a return left. After three returns, Editor SHALL approve or reject the group. Approval or rejection of a valid omission SHALL preserve the saved field.

#### Scenario: A group reaches the return limit

- **WHEN** validation returns a group and Editor returns it twice more
- **THEN** the last targeted review allows only approval or rejection of that group
- **AND** earlier decisions on independent groups stay in effect

#### Scenario: An editorial return ends in an omission

- **WHEN** Editor returns an Edition's tickets and Tickets omits the optional replacement with a reason
- **THEN** the separate review identifies that Edition's tickets as omitted and requires a decision on the omission
- **AND** a rejection records the decision, preserves saved tickets and lets an independent approved link proceed

### Requirement: Validation can return a group before review

After target selection, validation SHALL check the whole original reply even if a field is invalid. If the item checks pass, validation SHALL return each assigned group with a field error that it can link to that group, within the return allowance, budget and deadline. The owner SHALL receive the affected values and failed rules. An error that has no assigned group or remains after the validation return SHALL stop the item before review or writes. A valid omission of an optional group can proceed to review.

#### Scenario: Wacken tickets fail validation before Editor runs

- **WHEN** Tickets returns no offers and no free base price for the selected Wacken Edition, and its saved ticket page lists applicable offers
- **THEN** Tickets receives the empty-list rule with the return
- **AND** Tickets can cite the missed LOUDER-TICKET passage, which lists EUR 364 plus a EUR 2 fee, and submit a valid block for normal review
- **AND** this uses one of the group's three returns

#### Scenario: The specialist cannot establish a price

- **WHEN** the validator returns the Wacken ticket group and Tickets omits the optional replacement because it cannot confirm a price for that Edition
- **THEN** the first general review shows the omitted ticket group and its reason, and requires a decision on the omission
- **AND** accepting the omission preserves saved tickets, keeps the price question open and leaves the ticket check unfinished

#### Scenario: Tickets repeats the invalid offer block

- **WHEN** Tickets uses the return and again submits an empty offer list without a supported free base price
- **THEN** validation fails the item before Editor review or any catalog or audit write

#### Scenario: Wacken tickets have both a field error and an unknown reference

- **WHEN** the original Tickets answer has an empty offer list without a free base price and cites an unknown evidence ID
- **THEN** the validator reports the invalid reference even though the field check already failed
- **AND** the attempt ends with zero specialist returns and zero catalog or audit writes

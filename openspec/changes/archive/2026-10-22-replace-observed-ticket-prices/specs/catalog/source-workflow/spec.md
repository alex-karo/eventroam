# Spec Delta

## MODIFIED Requirements

### Requirement: Ticket availability belongs to each ticket variant

Only labelled ticket variants SHALL carry availability: unknown/available/sold_out/closed. Edition-level availability SHALL be rejected and SHALL NOT be inferred from variants or exposed publicly. Ticket writes SHALL atomically replace the stored block. A supported price for an Edition SHALL produce a replacement of offers observed in the current check; unverified saved offers SHALL NOT be copied. Without a supported price, research SHALL omit tickets and preserve the saved block. The editor SHALL assess evidence and Edition association without checking the full offer inventory.

#### Scenario: Categories have different availability
- **WHEN** Early Bird is sold out but Regular remains available
- **THEN** store those statuses per variant without changing schedule or producing aggregate availability

#### Scenario: Availability is known without an amount
- **WHEN** a priced offer supports replacement and another observed category has known availability but no price
- **THEN** the latter variant may include its label/availability without amount or currency

#### Scenario: Availability-only information does not replace prices
- **WHEN** only one variant's availability is newly known and no price is supported
- **THEN** research omits tickets and preserves the saved block

#### Scenario: Closed category does not imply cancellation
- **WHEN** category sales ended without sell-out evidence
- **THEN** use closed without inferring cancellation or global sell-out

#### Scenario: Packages and concessions are published
- **WHEN** inspected pages publish package, day, upgrade, or concession offers
- **THEN** research captures supported priced offers with qualifications and preserves base-price eligibility rules
- **AND** readable relevant prices are not omitted merely because other offers cannot be checked

#### Scenario: Some saved categories cannot be checked

- **GIVEN** a saved Regular ticket at EUR 100 and Student ticket at EUR 60
- **WHEN** an official page gives a Regular full-programme price of EUR 110 but Student checkout is blocked
- **THEN** research proposes a ticket block with the supported Regular EUR 110 offer and corresponding base price, omitting the unverified Student offer
- **AND** the editor may replace the stored block while the Student check remains unresolved and research status is partial

#### Scenario: No supported price is found

- **WHEN** relevant pages have no readable price or the source is unavailable
- **THEN** research omits the ticket finding and the saved block remains unchanged

#### Scenario: Only sales closure is announced

- **WHEN** a source reports closed sales but no supported price
- **THEN** the notice alone does not clear or replace the saved price block

### Requirement: Research findings and editorial actions use named typed fields

Research SHALL retain named Edition fields, stable keys and value/reason wrappers, with clarified null semantics and evidence in existing source summaries. The editor SHALL return named typed field actions: accept, set, clear or keep. Omission SHALL preserve state without claiming verification. Ownership SHALL follow the enclosing Edition. Generic patch paths, implicit null/empty-string mutation proposals and classification add/remove instructions SHALL NOT be accepted as editorial plans.

#### Scenario: Research reuses existing compound fields

- **WHEN** research returns classification or ticket information
- **THEN** use a complete classification value/reason finding preserving unchallenged saved terms; a ticket finding contains the supported offers to replace the stored block, without directly generating mutations
- **AND** when no supported ticket price is available, omit tickets and preserve the saved block while reporting unfinished checks in unresolved where appropriate

#### Scenario: Facts for two editions remain separate

- **WHEN** venue and ticket findings concern different Editions
- **THEN** findings and actions remain under their respective Edition keys

#### Scenario: Typed fields replace generic field names

- **WHEN** a plan contains unknown fields, wrong value types or arbitrary patch paths
- **THEN** reject the entire plan before writing

#### Scenario: A partial field update preserves other facts

- **WHEN** venueName uses set, locality is omitted and venueAddress uses clear with evidence
- **THEN** update the venue, preserve locality and clear only the address

#### Scenario: Missing actions cannot clear values

- **WHEN** a field is omitted or its optional wire slot is null
- **THEN** preserve the saved value without claiming it was reviewed
- **AND** set with null or an empty-string deletion sentinel is rejected; clearing requires a clear action

#### Scenario: Prices remain a complete replacement

- **WHEN** the editor sets tickets
- **THEN** require complete intended variants and basePrice; clear empties the block and keep preserves it
- **AND** structurally incomplete replacement blocks fail before writing

#### Scenario: Classification has one intended result

- **WHEN** the editor changes classification
- **THEN** set supplies complete intended term IDs, preserving unchallenged saved terms; clear removes assignments only where catalog rules permit
- **AND** invalid terms or publication state reject the whole item

#### Scenario: Schedule status has one source

- **WHEN** research establishes cancellation
- **THEN** the editor can set scheduleStatus=cancelled with evidence; reject legacy descriptor status

#### Scenario: Omitted schedule status preserves existing behavior

- **WHEN** scheduleStatus is omitted
- **THEN** preserve stored status or the creation default; historical research needs no completed status

#### Scenario: Add and refresh share one editorial shape

- **WHEN** either mode produces a plan
- **THEN** named field actions use the same typed contract, with creation restricted by mode and assignment

#### Scenario: Unknown or unverified values have no placeholder

- **WHEN** sources do not establish a value or a check is unfinished
- **THEN** research omits that value and describes limitations in unresolved questions
- **AND** the editor keeps or omits the field rather than treating saved values as new evidence

#### Scenario: No field-completion ledger is required

- **WHEN** a field is absent from findings or the plan
- **THEN** the host does not infer not_found, unfinished or verified status for it

#### Scenario: Editorial mutations require structured findings

- **WHEN** editor sets or clears an Event or Edition field, including a link slot or replacement block
- **THEN** the host requires a structured finding for the same owner, Edition key and field; source summaries and unresolved text alone do not authorize it
- **AND** reject the entire plan when that finding is absent; keep or omission remains permitted for saved Editions without findings

#### Scenario: Editor rejects a festival identity conflict

- **WHEN** editor assesses research and saved catalog context and returns `status:rejected` with a reason, including a wrong-festival identity conflict
- **THEN** the host performs no writes or publication and retains the rejection reason and output
- **AND** editor generation is successful while the item outcome is failed, in both add and refresh
- **AND** full research uses saved location as recovery leads and passes unresolved identity evidence to the editor; current instead stops with failed/null on a material identity contradiction before editing

#### Scenario: Editor output separates a plan from rejection

- **WHEN** the editor returns a typed output
- **THEN** it SHALL contain either `status:ready` with event, editions and unresolved, or `status:rejected` with a nonempty reason only
- **AND** missing status or rejected output containing actions fails validation

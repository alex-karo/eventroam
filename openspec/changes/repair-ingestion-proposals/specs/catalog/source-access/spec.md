# Spec Delta

## MODIFIED Requirements

### Requirement: Source support retains context and identity

A source-based change SHALL retain enough source context to identify its meaning and applicable Event or Edition. A matching quote SHALL NOT prove factual support by itself. Missing, ambiguous, or unrelated source references SHALL NOT authorize a change. The same source passage can support more than one field. Editor and the specialist revising a group SHALL have read-only access to all saved Markdown pages of the current run, including uncited pages, with source identity checks. The specialist SHALL be able to cite an applicable passage from those pages to support a revision within the assignment. A repair SHALL NOT fetch new pages or start discovery.

#### Scenario: The same passage supports two fields

- **WHEN** one passage establishes a venue and supports the Event description
- **THEN** both changes can use the same source passage without treating it as independent sources

#### Scenario: A quotation is ambiguous

- **WHEN** a reference cannot identify which repeated passage supports the claim
- **THEN** it is not accepted as attributable support and the limitation remains visible

#### Scenario: A quotation concerns another year

- **WHEN** a quote exists but concerns another Edition
- **THEN** it does not support changing the selected Edition

#### Scenario: A page description omits a condition

- **WHEN** a page description leaves out an eligibility condition or table qualification
- **THEN** a ticket change must still respect the original source condition

#### Scenario: A compact reference identifies a long passage

- **WHEN** extraction identifies a passage by its unique literal opening and closing text
- **THEN** saved support retains the complete original passage and its required context
- **AND** ambiguous, reversed, partially overlapping, or unmatched boundaries do not authorize a change

#### Scenario: The opening text is already the complete quotation

- **WHEN** unique literal opening text already contains the unique closing text as its exact suffix, including identical boundaries
- **THEN** the complete opening text can be bound as a normal literal quotation within the same size limit
- **AND** other partial overlaps remain invalid

#### Scenario: A quotation contains one extra wire escape

- **WHEN** a supplied quote or context has no literal match and contains a literal escaped newline or doubled backslash before Markdown punctuation
- **THEN** code may restore those escapes only if the whole resulting string has one exact source match
- **AND** saved evidence contains the exact original source text and span
- **AND** existing ambiguous literal matches, invented prices and unsupported text are not repaired

#### Scenario: A processing input omits empty metadata

- **WHEN** a downstream input omits empty context or optional metadata
- **THEN** all nonempty qualifications and the complete supporting passage remain available
- **AND** saved source provenance remains inspectable

#### Scenario: A saved-source search has no complete match

- **WHEN** validation searches saved source text and receives no matches or shortened matching lines
- **THEN** that result alone does not establish that a fact or qualification is absent
- **AND** a proposed change still needs applicable source support

#### Scenario: A repair cites a passage Reader missed

- **WHEN** a specialist revising a group cites a relevant passage that the original evidence did not include
- **THEN** the repair can cite it once its exact text and required context are bound to that page for this run
- **AND** a missing or changed source body cannot supply that evidence
- **AND** the repair does not replace the original Reader result or change the collection's coverage

#### Scenario: A repair citation contains incorrect context

- **WHEN** the quote matches the saved page but one context fragment does not
- **THEN** the citation tool identifies the failed context field and text, and states whether it is missing or repeated
- **AND** the specialist can correct the fragment from the saved page and retry within the return's budget
- **AND** the rejected call adds no evidence reference

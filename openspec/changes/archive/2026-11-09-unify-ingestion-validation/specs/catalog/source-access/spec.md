## ADDED Requirements

### Requirement: Reader keeps usable quotations from a partial reply

A Reader quotation SHALL have at least one topic to become evidence. If a quotation has no topics, ingestion SHALL omit it, record a source limitation, and keep other quotations that pass validation. An empty topic list at page level is valid.

#### Scenario: A page reply includes an untagged quotation

- **WHEN** Reader returns one untagged quotation and one uniquely matched quotation with a topic
- **THEN** the source has limited processing and retains the tagged quotation
- **AND** the untagged quotation alone does not stop collection

### Requirement: Reader can correct an invalid page reply

When a completed Reader reply fails the page response schema, ingestion SHALL allow one correction call with the same saved Markdown and the failed rules if the call allowance and deadline permit it. If there is no correction call left or the correction fails, ingestion SHALL record the source failure and stop the attempt before catalog writes.

#### Scenario: Reader exceeds the coverage list bound

- **WHEN** Reader returns too many coverage labels and a Reader call remains
- **THEN** the correction request identifies the bound and uses the same saved page
- **AND** a valid second reply can supply evidence for that page

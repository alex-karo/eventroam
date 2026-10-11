## ADDED Requirements

### Requirement: Research estimates festival size from participant evidence

Research SHALL explain each size estimate's basis in its fact reason. Relevant historical attendance MAY inform an upcoming Edition. Unsupported numbers, maximum occupancy alone, and repeated daily admissions without a supported participant interpretation SHALL NOT establish size. Missing size after completed checks SHALL NOT alone require partial.

#### Scenario: Attendance and capacity differ
- **WHEN** sources support roughly 8000 participants and maximum occupancy of 20000
- **THEN** research proposes sizeEstimate of 8000 with its basis explained

#### Scenario: Historical or insufficient evidence
- **WHEN** current participant numbers are unavailable
- **THEN** research may use relevant historical attendance with an explained basis; otherwise it omits sizeEstimate, preserving saved values

### Requirement: Size contracts use report version 4

Current ingestion and eval reports SHALL use version 4 with sizeEstimate facts and operations. Consumers SHALL reject historical versions without conversion. Stored historical reports SHALL remain unchanged.

#### Scenario: Report version boundary
- **WHEN** a report is generated or consumed after the size-contract change
- **THEN** new reports use version 4; version-2/version-3 reports are explicitly unsupported and remain unchanged in storage

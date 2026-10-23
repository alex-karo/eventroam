# Spec Delta

## MODIFIED Requirements

### Requirement: Discovery is limited to material source needs

Discovery MUST serve an unknown official source, source recovery, a material identity or date conflict, or an essential missing Edition fact.
Research MUST use relevant known links and prior results before another search.
The last case MUST concern an Edition supported by inspected evidence.
Essential facts MUST concern Edition identification, dates, or publication requirements.
Missing optional facts or an unannounced next Edition alone MUST NOT justify search.
Current source-recovery restrictions MUST still apply.

#### Scenario: Official sources contain no next announcement

- **WHEN** relevant accessible official sources have been checked without finding a next announcement
- **THEN** research reports that finding without searching solely for the missing announcement
- **AND** an empty `currentOrNextEdition` slot alone does not authorize discovery

#### Scenario: A known source conflicts with Event identity

- **WHEN** relevant known links cannot resolve a material identity or date conflict
- **THEN** research can discover and inspect a candidate within the budget if the scope permits source recovery
- **AND** current identity contradictions still require full refresh without replacement-site search

#### Scenario: An identified Edition lacks an essential fact

- **WHEN** inspected evidence supports an Edition but relevant known pages leave identification, dates, or a publication-required fact unresolved
- **THEN** research can make a targeted search for that fact within the shared budget
- **AND** it uses relevant prior results before another search
- **AND** search highlights remain leads until the destination is inspected

#### Scenario: Optional information is missing

- **WHEN** only optional prices or participant size remain unknown
- **THEN** those gaps alone do not authorize discovery

#### Scenario: Sources explicitly state that no next Edition is announced

- **WHEN** inspected official material states that the next Edition has not been announced
- **THEN** research can complete that announcement check without further search

#### Scenario: A search question is resolved

- **WHEN** inspected evidence resolves the question that authorized discovery
- **THEN** that question no longer authorizes another search
- **AND** permission does not require a search for every missing field

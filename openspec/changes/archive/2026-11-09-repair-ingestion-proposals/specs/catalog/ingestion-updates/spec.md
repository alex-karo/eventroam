# Spec Delta

## ADDED Requirements

### Requirement: The group owner supplies revised values

Only the assigned group owner SHALL supply a revised value or fill a returned omission. A revised proposal SHALL pass the same checks as an original proposal. If Editor supplies a replacement value, the item SHALL fail before writes.

#### Scenario: The ticket link points to an archive

- **WHEN** Links supplies an archived ticket link and a saved official page explicitly identifies the ticket overview for the selected Edition
- **THEN** Editor can return the link group to Links with the saved passage, even if Reader did not extract it
- **AND** Links can propose the URL with its source support
- **AND** an accepted correction changes only that Edition's ticket link

#### Scenario: Editor acts on one of several omissions

- **WHEN** several assigned fields have no proposal, each still has its return, and Editor has evidence for just the ticket link
- **THEN** Editor can return that omission to Links and review every submitted proposal without giving decisions for the other omissions
- **AND** the saved values of those other fields are preserved

#### Scenario: An omission is outside the assignment

- **WHEN** a current refresh has no proposal for a historical ticket, an Event website or either Event description
- **THEN** Editor cannot return those groups, even if it finds the values on a saved page

## MODIFIED Requirements

### Requirement: Field groups remain complete and owned

Dates, tickets, and classification SHALL follow their complete-group or replacement rules. The final venue, address, locality, administrative area, country, and point SHALL describe one coherent place. Omission SHALL preserve saved values unless evidence supports removal. One Edition SHALL NOT change a sibling. An invalid target SHALL reject the item. An invalid type or incomplete replacement in the final result SHALL also reject the item.

#### Scenario: A date correction

- **WHEN** an Edition date range changes
- **THEN** the proposal supplies a complete start and end pair for that Edition

#### Scenario: A field is omitted

- **WHEN** ingestion updates an Edition name without a supported ticket replacement
- **THEN** tickets remain unchanged

#### Scenario: A location field is preserved

- **WHEN** ingestion changes the venue and preserves locality without evidence that the saved locality is wrong
- **THEN** locality remains unchanged

#### Scenario: A complete ticket proposal is rejected
- **WHEN** a complete ticket replacement is rejected
- **THEN** the saved price block, including any existing offer URLs, remains unchanged
- **AND** no part of the rejected block is written separately

#### Scenario: A new venue invalidates its old address and point
- **WHEN** a supported place change includes a new venue and supported removal of its old address and point
- **THEN** the result does not combine the new venue with those disproved saved values

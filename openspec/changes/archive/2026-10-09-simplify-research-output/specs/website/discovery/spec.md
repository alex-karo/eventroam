# Discovery availability delta

## ADDED Requirements

### Requirement: Discovery does not display aggregate ticket availability
Discovery summaries SHALL omit edition-wide ticketAvailability. Result lists, map markers, and popups SHALL NOT display aggregate sold-out/closed indicators or infer them from ticket variants. Availability SHALL remain outside filtering and ordering; schedule status rules SHALL remain unchanged.

#### Scenario: Stored aggregate conflicts with category availability
- **WHEN** an otherwise eligible edition has stored aggregate sold_out or closed
- **THEN** it remains discoverable without a sales badge, sold-out marker flag, or availability text in its popup

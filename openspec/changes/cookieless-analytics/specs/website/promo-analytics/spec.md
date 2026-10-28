## MODIFIED Requirements

### Requirement: Owner browsers can stop capture

The application SHALL block new analytics capture when a visitor opens `?analytics=off`, before sending the page view. The choice SHALL apply to later visits on that origin. `?analytics=basic` SHALL select cookieless capture. `?analytics=on` SHALL accept a persistent browser identifier. Clearing site storage SHALL return to basic capture and show the choice banner. The documentation SHALL provide links for both public origins and explain that earlier events remain stored.

#### Scenario: Owner disables capture

- **WHEN** the owner opens an origin with `analytics=off`
- **THEN** that visit and later visits on that origin collect no new analytics events
- **AND** another browser remains unaffected

#### Scenario: Owner restores capture

- **WHEN** the owner opens that origin with `analytics=on`
- **THEN** a persistent browser identifier is enabled

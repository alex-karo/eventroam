## ADDED Requirements

### Requirement: Discovery uses estimated festival size

Discovery SHALL use sizeEstimate for its existing size bands and thresholds. The Size filter SHALL explain approximate participant numbers; list results SHALL qualify known size as an estimate in people. Unrestricted size SHALL include unknowns; any selected band SHALL exclude them. Size URLs, readable chips, and all other matching rules SHALL remain unchanged.

#### Scenario: Size filtering
- **WHEN** a size band is selected
- **THEN** estimates on 1000, 5000, 20000, or 50000 enter the band beginning at that value; unknown size is excluded

#### Scenario: Unrestricted size
- **WHEN** no size band is selected
- **THEN** Editions with unknown size remain eligible and show no numeric size

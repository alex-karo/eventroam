## ADDED Requirements

### Requirement: Public details present estimated festival size

Edition pages and selected previews SHALL display known size as “Estimated size: <number> people”, using English number formatting. Unknown size SHALL have no numeric label.

#### Scenario: Known and unknown size
- **WHEN** a public Edition detail is displayed
- **THEN** sizeEstimate of 8000 displays “Estimated size: 8,000 people”; null omits the size label

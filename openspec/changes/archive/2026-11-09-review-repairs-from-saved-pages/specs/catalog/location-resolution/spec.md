## MODIFIED Requirements

### Requirement: Location owns a coherent place description

The final venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates SHALL describe one coherent place for each addressed Edition. A changed venue SHALL NOT retain an address or point disproved by the same evidence. Unsupported fields SHALL preserve saved data without claiming fresh verification. Invalid or inconsistent final place data SHALL reject the item.

Location SHALL supply explicit decisions for all place fields. Editor SHALL approve, reject, or return the place group to Location under the group return rules. Editor SHALL NOT supply replacement place values. The complete place SHALL pass location validation. A return SHALL have no geocoding calls available and SHALL use the existing point choices. Other specialists SHALL NOT supply place changes.

#### Scenario: A new venue has an old address

- **WHEN** sources establish a new venue and show that the saved address belongs to the old venue
- **THEN** ingestion does not keep that address as if it belonged to the new venue
- **AND** it explicitly clears the disproved address or supplies a supported replacement

#### Scenario: Location data is incomplete but not disproved

- **WHEN** a field has no supported replacement or evidence against its saved value
- **THEN** the saved value is preserved without claiming fresh verification

#### Scenario: A text action is missing

- **WHEN** the final Location proposal omits a decision for a place text field
- **THEN** validation rejects the whole item before writes

#### Scenario: Plans overlap in field ownership

- **WHEN** Editor supplies a replacement place value or Location supplies a non-location change
- **THEN** validation rejects the whole item before writes

#### Scenario: The organizer spells the same venue differently

- **WHEN** a saved passage that Reader missed gives the spelling of the same venue for the selected Edition
- **AND** the address and the point from the earlier geocoding result still describe that venue
- **THEN** Editor can use the group's return and give Location the passage in its note
- **AND** Location can correct the venue name and use the same point without a new geocoding request
- **AND** Editor checks the corrected name on the saved page before approval

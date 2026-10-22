# Spec Delta

## ADDED Requirements

### Requirement: HTML table extraction preserves row relationships
The source reader SHALL keep the content of each converted HTML table row together on one Markdown table line. It SHALL preserve factual cell text and links while preventing interactive quantity choices from appearing as joined numeric facts.

#### Scenario: A cell contains a line break
- **WHEN** a table cell places a descriptive note after an HTML line break
- **THEN** the source Markdown keeps the note and the other cells in the same table row

#### Scenario: A purchase quantity selector appears in a cell
- **WHEN** a ticket table contains a control for choosing purchase quantity
- **THEN** the source Markdown does not concatenate its options into a numeric value
- **AND** ticket names and prices remain available in their respective cells

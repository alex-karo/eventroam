# Spec Delta

## ADDED Requirements

### Requirement: HTML table extraction preserves row relationships
The source reader SHALL keep the content of each converted HTML table row together on one Markdown table line. It SHALL preserve factual cell text and links while showing selection controls and their options as explicitly labeled choices.

#### Scenario: A cell contains a line break
- **WHEN** a table cell places a descriptive note after an HTML line break
- **THEN** the source Markdown keeps the note and the other cells in the same table row

#### Scenario: A selection control appears in a cell
- **WHEN** a converted table contains a select control with multiple options
- **THEN** the source Markdown identifies it as a control and separates its option labels
- **AND** the other cells in the row retain their values

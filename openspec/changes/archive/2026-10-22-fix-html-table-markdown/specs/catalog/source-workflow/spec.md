# Spec Delta

## ADDED Requirements

### Requirement: HTML table extraction preserves row relationships
The source reader SHALL keep the content of each converted HTML table row together on one Markdown table line. It SHALL preserve factual cell text and links while omitting HTML select controls and their option text from source Markdown.

#### Scenario: A cell contains a line break
- **WHEN** a table cell places a descriptive note after an HTML line break
- **THEN** the source Markdown keeps the note and the other cells in the same table row

#### Scenario: A selection control appears in a cell
- **WHEN** a converted table contains a select control with multiple options
- **THEN** the source Markdown omits the control and its option text
- **AND** the other cells in the row retain their values

#### Scenario: A selection control appears outside a table
- **WHEN** the page contains a select control outside a table
- **THEN** the source Markdown omits the control and its option text

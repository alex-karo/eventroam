# Spec Delta

## ADDED Requirements

### Requirement: Applied source-driven facts retain field evidence
The system SHALL tie each source-driven applied field change to the inspected source, final URL, authority at retrieval, UTC retrieval time, supporting excerpt or snapshot reference, and the actual writer and initiating owner.

#### Scenario: Different sources support different fields
- **WHEN** one source supports a date update and another supports a venue update in the same operation
- **THEN** each field change identifies its own supporting evidence and the audit entry retains both old and new values

### Requirement: Evidence history is immutable and private
The system SHALL retain applied field-change evidence and original observed values without exposing them in public summaries, pages, or discovery responses.

#### Scenario: Source URL changes later
- **WHEN** the current source URL or authority is edited after an applied change
- **THEN** the earlier audit evidence still describes the source as inspected at the time of that change

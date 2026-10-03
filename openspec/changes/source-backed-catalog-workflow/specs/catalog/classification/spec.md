# Spec Delta

## ADDED Requirements

### Requirement: Source-backed classification is edition-specific
The system SHALL apply classification additions, removals, and complete replacements only with evidence applicable to that Occurrence. Copying a prior edition's terms MAY seed a new draft, but publication SHALL require current applicable support and SHALL not change sibling editions or Event defaults.

#### Scenario: Prior edition's genre is copied into a new draft
- **WHEN** a new Occurrence starts with a previous edition's terms but the current edition has no supporting programme evidence
- **THEN** the draft may retain candidate terms but cannot publish them as verified classification

#### Scenario: A later extraction omits a known term
- **WHEN** a source check does not mention a previously accepted genre
- **THEN** the run does not remove that assignment unless supported evidence or an explicit owner correction justifies the removal

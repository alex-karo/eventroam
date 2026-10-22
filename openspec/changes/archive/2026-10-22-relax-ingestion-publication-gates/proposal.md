# Proposal

## Why

Ingestion currently leaves otherwise complete Editions as drafts when only their country is known or their classification differs from the hardcoded festival values. Publication should require the agreed minimum facts and classification facets.

## What Changes

- Accept a country without a venue, locality, or region for publication.
- Require one `format`, one `event_type`, and at least one `topic` or `culture` term. Accept any valid assigned value within those facets.
- Keep the existing year and date-pair requirement for each published Edition. A historical Edition can satisfy the Event's published-Edition requirement; no next-year Edition is required.
- Out of scope: display changes, publishing undated Editions, copying a previous location, new vocabulary or scope routing, and changes to other ingestion safeguards.

## Capabilities

### Modified Capabilities

- `catalog/publication`: Relax location detail and classification-value gates used by ingestion and the catalog writer.

## Impact

Update the existing shared validators and their domain, writer, and ingestion tests. Align publication specification wording and the ingestion guide with the relaxed gates. Keep the current storage schema, publication operations, and public rendering.

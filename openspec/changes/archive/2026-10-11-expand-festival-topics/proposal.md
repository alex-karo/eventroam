# Proposal

## Why

Music festivals can combine substantial snow sports, surfing, culinary experiences, and outdoor recreation. The catalog needs these topics and an unambiguous distinction between open-air format and outdoor activities.

## What Changes

- Add curated `topic/snow-sports`, `topic/surfing`, `topic/food-and-drink`, and `topic/outdoor` to fresh development and evaluation vocabularies.
- Keep source-backed term definitions and assignment guidance in the vocabulary document and research prompt, outside behavioral specs.
- **BREAKING**: Replace the format slug `outdoor` with `openair` and label it Open-air; keep `mixed-indoor-outdoor` unchanged.
- Update publication checks, research instructions, fixtures, and tests without database migrations or existing-data rewrites, as requested by the owner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/classification`: Keep topics independent of physical format; leave individual term definitions in curated vocabulary.
- `catalog/publication`: Require `openair` or `mixed-indoor-outdoor` rather than the former outdoor format slug.

## Impact

Development seeds, captured-page eval taxonomy, research prompts and preparation, writer publication validation, and owning documentation/specifications. No new facets, schema changes, public filter controls, or live research runs. Existing databases are not upgraded by this change.

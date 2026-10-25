# Proposal

## Why

Research can return both event types, and the editor can accept them. Preparation rejects the list with a generic error.

## What Changes

- Share facet limits and event type guidance between both models.
- Direct the editor to correct supported conflicts or preserve uncertain values.
- Report the facet, limit, and conflicting IDs. Keep strict validation.

## Capabilities

### Modified Capabilities

- `catalog/classification`:
  - **Before**: Facet limits exist but are absent from model instructions.
  - **After**: Both models receive the rules. The editor must use existing `set` for supported corrections, or keep/omit classification and report uncertainty.
- `catalog/ingestion-runs`:
  - **Before**: Classification count errors are generic.
  - **After**: They identify the field, facet, limit, and conflicting IDs.

## Impact

Changes affect prompts, their versions, validation messages, and tests. No database, report schema, retry, or saved-plan recovery changes.

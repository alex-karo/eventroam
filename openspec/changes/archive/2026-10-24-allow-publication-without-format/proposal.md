# Proposal

## Why

Research can establish festival dates, country, and programme without establishing its physical format. Such an Edition currently stays draft even when all other publication facts are present.

## What Changes

- Allow publication when physical format is unknown.
- Keep the year, dates, country, event type, and topic or culture requirements.
- Keep format evidence rules and assignment validation.
- Align publication tests, classification instructions, and current documentation.

## Capabilities

### Modified Capabilities

- `catalog/publication`:
  - **Before**: Publication requires one format assignment.
  - **After**: Publication permits an absent format assignment.
- `catalog/classification`:
  - **Before**: Topics cannot satisfy the required publication format gate.
  - **After**: Topics remain independent of optional physical format.

## Impact

The shared publication validator serves ingestion and direct catalog writes. No database migration is needed. Existing drafts keep their state until an explicit publication operation, including an eligible ingestion apply run.

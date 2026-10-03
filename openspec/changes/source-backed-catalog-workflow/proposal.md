# Proposal

## Why

As the catalog owner, I need to discover, import, verify, refresh, and publish events from attributable sources without losing accepted facts or creating duplicates. The current fixture-backed service has validated writes and audit history but no source-evidence or ingestion workflow.

## What Changes

- Add owner-initiated source inspection, draft import, discovery, and refresh runs.
- Require attributable, edition-relevant evidence for affected facts before publication or source-driven updates; preserve source conflicts and unknowns instead of guessing.
- Extend applied change history with the evidence and field changes needed for background owner retrieval, while keeping it out of public payloads.
- Collect edition-specific capacity, ticket availability, original-currency prices, and qualified practical details without converting missing or ambiguous source text into asserted facts.
- Require edition-relevant evidence for classification changes and distinguish a fallow year from a cancelled edition.
- Report stable per-record outcomes and make retries idempotent.

## Capabilities

### New Capabilities

- `catalog/source-workflow`: Owner-initiated import, discovery, refresh, conflict handling, and run reporting.

### Modified Capabilities

- `catalog/records`: Add evidence to applied catalog changes without changing durable record identity.
- `catalog/classification`: Require applicable evidence for assignment changes and new-edition publication.
- `catalog/publication`: Add source-backed publication gates and preserve qualified public facts.

## Impact

Catalog operations and storage, a future ingestion entry point, source and audit records, and the owner's operation interface. Exact command/API transport, conflict codes, dump mapping, and snapshot retention remain open in [release decisions](../../../docs/proposals/release-open-decisions.md); design and implementation tasks will be added after those decisions.

# Proposal

## Why

As the catalog owner, I need to discover, refresh, and publish events using model-interpreted sources without losing accepted facts or creating duplicates. The current fixture-backed service has validated writes and audit history but no local research workflow.

## What Changes

- Support three owner-initiated scenarios: add a festival with its latest completed and next announced editions; validate and refresh an existing event; check known links for new or changed information, including dates, location, and ticket availability. Source discovery remains in scope; legacy import is outside this change.
- Collect official links and produce a short factual English description based on model interpretation of inspected information; keep edition facts separate and do not invent an unannounced next edition.
- Run locally with OpenRouter in the first version. Preserve Facebook and Instagram links, but report content retrieval as unsupported; server execution, unattended scheduling, and social-content retrieval are deferred.
- Read public source pages through bounded HTTP without executing page scripts; report sparse script-dependent HTML as partial so missing facts are not treated as confirmed absent.
- Use one model answer per run with a compact operation adapter and the existing catalog writer; keep requested target boundaries, response-schema validation, versions, and atomic writes.
- Accept the model’s factual interpretation directly. The host does not verify excerpts, authority, conflicts, or supersession; omitted facts preserve stored values.
- Retain actor, initiating owner, and old/new values in CatalogChange history. Source read outcomes stay in local reports. No new source, observation, or run entities are required.
- Collect capacity, ticket availability (including `closed` sales), and ticket variants with original-currency prices and conditions. Replace the price block in full when the model supplies one; an explicitly empty block clears prices. Variant display on the website is deferred.
- Apply model-selected edition classifications while preserving sibling editions and distinguish a fallow year from a cancelled edition.
- Report per-record outcomes, changes, and sources; retain idempotent writer operations. After interruption, rerun against the current catalog. Automatic run recovery and a history-viewing command are deferred.

## Capabilities

### New Capabilities

- `catalog/source-workflow`: Locally initiated festival addition, validation and refresh, known-link checks, discovery, model-selected facts, and run reporting, with OpenRouter and explicit social-source limitations.

### Modified Capabilities

- `catalog/records`: Store ticket variants and closed-sales status while preserving durable record identity and audit attribution.
- `catalog/classification`: Preserve edition-specific assignments and omitted classifications.
- `catalog/publication`: Use structural publication gates for model proposals and preserve qualified public facts.

## Impact

Catalog operations and existing audit storage, a local collection entry point, and the owner's operation interface. [Design](design.md) defines the proposed command interface, collection approach, and audit storage; implementation tasks remain separate. Snapshot storage and retention are deferred rather than prerequisites. Remaining release-wide choices are tracked in [release decisions](../../../../docs/proposals/release-open-decisions.md).

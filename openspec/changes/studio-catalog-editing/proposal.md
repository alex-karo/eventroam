# Proposal

## Why

The owner can inspect catalog data and start research from Studio chat. The owner needs a direct way to correct an Event description, fix a URL, or rename a set of links after reviewing the exact changes.

## What Changes

- Let the owner edit existing Events, Editions, and links through the catalog assistant. The scope includes both Event descriptions, Event slugs, and Edition prices, classifications, and location. Creation, deletion, and publication actions are outside this change.
- Let the catalog assistant search the public web through OpenRouter and cite sources in chat. The owner can use those sources to review a proposed correction.
- Show the full set of proposed values and the audit mode before approval. Approval applies the selected card's changes to the current records. Report the result for each Event or Edition in the batch.
- Record approved changes in `catalog_changes` by default. Let the owner explicitly omit these entries for a direct edit.

## Capabilities

### Modified Capabilities

- `catalog/studio-assistant`
  - **Before**. Studio chat reads catalog data and submits research jobs.
  - **After**. The owner can also search for public sources through OpenRouter and review and approve direct edits in Studio chat.
- `catalog/records`
  - **Before**. Each actual catalog operation records a `CatalogChange`.
  - **After**. An approved direct edit can omit its `CatalogChange` and still saves operation receipts.

## Impact

The change affects the Studio catalog assistant, its OpenRouter model requests, its approval path, and the catalog writer. It uses the current audit table and does not require a new catalog table or audit view.

# Proposal

## Why

The owner can inspect catalog data and start research from Studio chat. The owner needs a direct way to correct an Event description, fix a URL, or rename a set of links after reviewing the exact changes.

## What Changes

- Let the owner edit existing Events, Editions, and links through the catalog assistant. The scope includes both Event descriptions, Event slugs, and Edition prices, classifications, and location. Creation, deletion, and publication actions are outside this change.
- Let the catalog assistant search the public web through OpenRouter and cite sources in chat. The owner can use those sources to review a proposed correction.
- Show the full set of proposed values and the audit mode before approval. Use the built-in Studio approval card for one pending edit at a time. Apply the approved changes to the current records. Report the result for each Event or Edition in the batch.
- Record approved changes in catalog history by default. Let the owner explicitly omit these entries for a direct edit.

## Requirements

- The owner can correct existing Event names, aliases, URL slugs, and both descriptions, plus Edition names, years, dates, status, size, location, prices, and categories.
- Existing link kinds, URLs, labels, and official flags can be corrected. Direct editing does not create or delete records, add or remove links, change identities, or change publication state.
- OpenRouter web search supplies cited public sources and states uncertainty. Search alone starts no edit or ingestion; other providers retain reads and approved edits without search.
- Before built-in Studio approval, show every target, old and new value, and history choice. Allow one pending proposal per chat. Revised values need new approval; an oversized selection must be reduced.
- Apply only approved fields to current records and preserve unrelated concurrent edits. Rejection, preview, and requests without approval leave the catalog unchanged.
- Save each Event or Edition and its link corrections together. A failure leaves that whole item unchanged, while other items can succeed. Report changed, unchanged, or failed for each item.
- Record actual changes and owner attribution by default. Omit history only for an explicitly approved direct edit; retain public redirects, validation, and protection against repeated writes. Research keeps its history.
- Repeating a completed approved request returns its earlier result without applying it again or changing later edits.
- Keep explicit refresh requests separate from direct edits. Refresh uses the requested selection, full scope by default, and republish off; reads, previews, and analysis authorize no catalog writes.

## Acceptance criteria

- Description, country, public URL, price, category, and selected link-label corrections show complete proposed values. Clearing one description preserves the other, and old public URLs still redirect.
- A URL search returns cited results. A requested correction waits for approval; search-only requests start no edit or ingestion, and an unsupported provider reports the search limit.
- Studio defaults to recording changes. Ambiguous targets, incomplete selections, and requests outside direct-edit scope receive no approval. Rejection and approval bypass attempts leave the catalog and its history unchanged.
- An approved field overwrites that field's current value while preserving unrelated concurrent edits and newly added links.
- A missing link or invalid correction leaves its whole Event or Edition unchanged. Other valid items succeed and report their own results.
- Repeated approved requests return their earlier result without another change. Normal edits identify the owner and actual old and new values; approved history omission adds no edit-history entry.
- Read-only questions start no refresh. A current-scope preview uses dry run with republish off; a supplied direct edit opens approval without starting refresh.

## Impact

The owner gains direct catalog corrections and source search in Studio chat. Existing catalog validation, link inheritance, public URLs, and research workflows remain applicable. Implementation affects the assistant, approval path, and catalog writer.

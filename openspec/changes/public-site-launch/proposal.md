# Proposal

## Why

As a visitor, I need complete, shareable Event and Occurrence pages that search engines can identify and reach. The fixture-backed site serves direct pages and basic discovery canonicals, while detail metadata, sitemap coverage, and public launch setup remain incomplete.

## What Changes

- Complete record-specific titles, descriptions, social metadata, and relevant structured data for public Event and Occurrence pages.
- Generate discovery paths and sitemaps for the launched Festivals scope from the public catalog, retaining linked historical pages and excluding unpublished records.
- Preserve existing ordinary result and edition-history links while adding crawler metadata.
- Prepare actual launch origins and host-level crawler behavior without changing existing stable public URLs.

## Capabilities

### New Capabilities

- `website/discoverability`: Complete metadata and crawler discovery for currently launched public pages.

### Modified Capabilities

None. Existing scoped routes and discovery behavior remain the base contract.

## Impact

Next.js metadata, sitemap and crawler routes, launch-origin configuration, and tests for public visibility. Detailed cross-scope redirects, alias policy, and indexing defaults remain unapproved in [routing proposals](../../../docs/proposals/website-routing-and-indexing.md); design and tasks will follow those decisions.

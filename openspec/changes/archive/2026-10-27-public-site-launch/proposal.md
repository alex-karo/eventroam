# Proposal

## Why

People who search for festivals need to find the catalog and the correct Event or Edition page. Existing routes have basic discovery metadata, but detail metadata, structured data, and crawler routes are missing.

## What Changes

- Complete titles, descriptions, canonical URLs, and social metadata for the existing apex, discovery, Event, and Edition pages. Add no preview images.
- Use `https://eventroam.org` for the project presentation and `https://festivals.eventroam.org` for the catalog through the existing origin configuration.
- Make both clean roots and all public Event and Edition pages indexable. Keep historical, cancelled, postponed, and sparse published records eligible without a new SEO publication gate or an indexing switch.
- Serve `robots.txt` and `sitemap.xml` on each configured host. Include only that host's public canonical pages and read current publication state.
- Add Event JSON-LD to Edition pages when current public facts support the required fields. Keep ordinary page indexing independent from structured-data eligibility.
- Preserve filtered discovery `noindex,follow`, query normalization, stable routes, public visibility checks, redirects, and ordinary links through edition history.
- Add minimal JSON-LD tests and one HTTP smoke suite for the built application. Document later manual Search Console steps.

## Out of Scope

Real-data collection and updates; changes to publication gates or the catalog model; photos and generated preview images; new about, privacy, country, genre, or editorial pages; services SEO; DNS, TLS, server setup, and deployment execution; and Search Console actions. The owner confirms that infrastructure is already configured. Application readiness does not depend on a later feature activation.

## Capabilities

### New Capabilities

- `website/discoverability`: Metadata, structured data, indexing policy, and crawler discovery for the existing public pages.

### Modified Capabilities

None. Existing routing, discovery, and publication requirements remain the base contracts.

## Impact

Next.js page metadata and crawler routes, `site/server`, a public catalog URL query, tests, and launch instructions. No database migration, new dependency, or infrastructure change is required. This change owns the agreed first-launch indexing policy; [remaining website proposals](../../../../docs/proposals/website-routing-and-indexing.md) do not block it.

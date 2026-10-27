# Design

## Context

See the [proposal](proposal.md) for scope and the [discoverability delta](specs/website/discoverability/spec.md) for required behavior. Existing [routing](../../../specs/website/routing/spec.md), [publication](../../../specs/catalog/publication/spec.md), and [discovery](../../../specs/website/discovery/spec.md) remain the base contracts.

`src/site/site.ts` owns host selection and paths. `site/server/public-request.ts` owns public detail reads and redirects. The root has filter metadata; detail pages inherit generic metadata. Crawler routes and JSON-LD are absent. Discovery omits cancelled and postponed Editions, but public detail reads retain them.

## Goals / Non-Goals

**Goals:** Add crawler output at existing page and read boundaries. Share URL and visibility rules.

**Non-Goals:** No separate SEO service, visibility model, persistent cache, or storage migration. Other scope exclusions are in the proposal.

## Decisions

### 1. Reuse configured URLs and page adapters

Use `siteOrigins()` and existing path builders for canonical, social, sitemap, and JSON-LD identity URLs. Public origins are `https://eventroam.org` and `https://festivals.eventroam.org`; retain local defaults. Do not derive origins from arbitrary request hosts. This avoids a second routing configuration.

Use Next.js Metadata exports and `generateMetadata` on existing pages. Small builders in `site/server` receive public DTOs. Metadata and detail content share the public request result through React request memoization. This avoids duplicate reads without a cache across requests.

Event metadata uses its name and summary or a factual history fallback. Edition metadata uses the stored year, not its key, and existing date, place, and status formatting. Use `isPastEdition` with the same request time as page content where needed. This avoids a second date policy. Add text Open Graph metadata with `type: website` and a Twitter `summary` card; declare no images.

Keep existing filter canonicals, `noindex`, visibility checks, and redirects. Their rules remain in the owning specs; this change adds no activation or completeness gate.

### 2. Read crawler output per host and request

Add Next.js `robots.ts` and `sitemap.ts` routes through existing request-site resolution. Robots permits public pages and queries and points to that host's sitemap. Unknown hosts use the existing unavailable-site response. Request-time output must use runtime origins and current publication state; a static build result could retain local origins or withdrawn records.

Add one small URL query in `catalog/read` that shares public-read conditions. Select only current slugs and Edition keys. Include Events with at least one public Edition; deduplicate Event URLs and use stable ordering. One joined query is sufficient; use a read transaction only if multiple reads are needed. Existing discovery reads omit retained Editions, and full detail reads load unneeded terms, links, and tickets.

Use framework XML serialization. The apex lists its root; Festivals lists its root and public Event and Edition URLs. Omit optional `lastmod`, priority, and change frequency: no reliable public modification time exists.

### 3. Build optional Edition JSON-LD from public facts

Use a pure builder that returns one Event object or no object. Insert it only on the Edition page. Require confirmed dates, a public name, and a country plus street address or locality. A venue name, region, or map point alone is insufficient. This output rule does not change publication or indexing.

Use known name, description, clean `url` and `@id`, `Place`/`PostalAddress`, and date-only start/end values. Map `announced` and `scheduled` to `EventScheduled`, cancellation to `EventCancelled`, and postponement to `EventPostponed`. Keep retained dates and stored status for past Editions. Do not infer rescheduling or previous dates from audit data. Omit unsupported fields, including images, organizers, performers, and offers.

Escape `<` when serializing JSON into its script element. Public text must remain data. [Google's Event guidance](https://developers.google.com/search/docs/appearance/structured-data/event) supports date-only values and cancellation/postponement status. Missing recommended fields can still limit rich-result display; adding catalog fields is outside scope.

### 4. Use minimal tests and existing guides

Add only two kinds of new checks:

- A small JSON-LD test table: eligible facts and date-only output, omitted provisional dates or insufficient address, cancellation/postponement status, and safe script serialization.
- One HTTP smoke suite, extended with each feature and run against the built application. Use existing validated temporary fixtures and a crawler user agent. Check both roots and one Event/Edition pair for title, clean configured canonical/social URLs, permitted indexing, and absent social images; check one filtered root for `noindex`. Check both hosts' robots/sitemaps, unknown-host rejection, published URL inclusion, and draft/private-value exclusion. Withdraw the fixture Edition and check the next sitemap response. Check JSON-LD presence on an eligible Edition and omission on one sparse Edition and aggregate pages.

These checks cover output wiring and the main publication/cache risks. Do not add separate metadata or inventory unit suites, full content matrices, repeated dev-server runs, or new browser/navigation tests. Existing public-read and UI tests retain their current coverage. The smaller suite does not check every spec scenario separately.

Update the existing development guide and project structure with each feature. Include public origins, crawler routes, JSON-LD eligibility, and later manual Search Console steps. Account actions and real-data updates are not completion conditions.

## Risks / Trade-offs

- Sparse facts and absent images can limit search visibility and rich results. Keep pages indexable and improve content through the separate data process.
- Host or publication caching can return wrong URLs. Use request-time output and the smoke checks above.
- Minimal tests give less coverage of content combinations and browser behavior. Reuse current helpers and existing tests; add no new test matrix.

## Migration Plan

No data migration or indexing activation is needed. Verify with the current local setup and configured origins. Deployment execution stays outside this change; rollback uses the previous application release. Sync the discoverability delta after implementation. Search Console actions remain manual.

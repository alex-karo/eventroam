# Website structure and URLs

Date: 2026-10-01  
Status: Scope domains and discovery interaction confirmed by the owner; the remaining structure and routing rules are proposed implementation defaults.

## 1. Confirmed direction and boundaries

Separate catalog scopes through subdomains, starting with `festivals.eventroam.com`. Future scopes can use domains such as `it.eventroam.com`. These are subject scopes, not languages or countries; all first-release public content remains English. Interpret `it` as information technology provisionally, pending the definition of that future scope.

The first release still covers open-air music festivals and burning-like gatherings under the [foundation](000-product-foundation.md). An example future domain does not add conferences or another vertical to this release. Agent execution and operation-interface decisions are deferred to the next iteration.

Discovery has two presentations of the same results: map and list. Show both together on desktop; provide an easy Map/List switch on smaller screens. The backend returns the complete discovery summary set, and full details load when a visitor opens a result. There is no “Search this area” action, bounding-box query, viewport-triggered result fetch, or result pagination. Moving the map changes only its presentation.

**Proposed delivery interpretation:** return all public discovery summaries for the active scope and filter them in the browser, with the same rules used for the server-rendered list on direct entry. This interpretation of “returns all” remains a proposed default; the complete set must include matches without coordinates and enforce publication gates on the server. The [discovery specification](004-discovery-filters.md) owns filter semantics and summary delivery.

## 2. Domains and site hierarchy

The proposed structure is:

| Host and path | Purpose | Release |
| --- | --- | --- |
| `eventroam.com/` | Small Eventroam introduction and directory of available scopes | V1 |
| `eventroam.com/about` | Shared explanation of the catalog, coverage, and uncertainty labels | V1 |
| `eventroam.com/privacy` | Shared privacy information reflecting the implemented site | Before public launch |
| `festivals.eventroam.com/` | Festival discovery: filters, list, and map | V1 |
| `festivals.eventroam.com/events/{eventSlug}` | Durable Event page with links to its published editions | V1 |
| `festivals.eventroam.com/events/{eventSlug}/{occurrenceKey}` | One specific Occurrence and its full details | V1 |
| `it.eventroam.com/` | Discovery for a future, separately specified IT scope | Deferred |

The apex is a scope directory, not a duplicate festival catalog or an automatic redirect. With only one launched scope, give Festivals a direct prominent link. Do not display empty future catalogs as active navigation destinations or publish indexable placeholder scope sites.

Scope navigation identifies the current scope and offers links to launched alternatives plus the apex. Each scope root is its discovery page; do not add synonymous `/map`, `/list`, `/search`, or `/festivals` routes. Shared informational pages live on the apex and are linked from each scope footer.

Country, city, genre, and date selections remain filters rather than path hierarchies. Curated editorial landing pages, global cross-scope search, localization, accounts, and submissions are deferred. No language prefix, year archive route, or country subdomain is needed for V1.

## 3. One application, shared identity, explicit scope

Use one application and shared catalog, with an explicit allowlisted mapping from host to scope. A scope configuration provides its host, public name, and discovery eligibility rules. The host selects a catalog scope; it does not select a separate database or create a new copy of an Event.

The Festivals scope uses the release eligibility rules already established in the foundation and taxonomy. Evaluate discovery membership per Occurrence using its own facts and classifications. A scope is a product/navigation concept, not a sixth taxonomy facet or an inherited Event classification. Define each future scope's membership rules and filters before launching it.

Retain globally unique Event slugs and shared Event/Occurrence IDs from the [domain model](001-domain-model.md). A record can eventually qualify for several scopes without being duplicated. Propose a small routing attribute, `homeScope`, on the Event, assigned at first publication; all its Occurrences share that canonical host. This is URL ownership metadata, not a claim that every edition has the same classification. Its physical storage and audit integration belong in the schema specification.

For V1, every public Event has `homeScope = festivals`. Before launching overlapping scopes, define how to choose the initial home scope. Never recalculate an existing canonical host from current filters, genre edits, or a visitor's entry point. An explicit home-scope migration preserves the same IDs and redirects the old URLs.

Generate absolute links from configured public origins, not an arbitrary request `Host` or forwarded-host value. Unconfigured hosts do not expose a default catalog. Configure DNS and TLS for each launched host; do not make wildcard subdomains silently create new scopes.

## 4. Event and Occurrence pages

### Stable paths

Use these shapes on the Event's canonical host:

```text
/events/{eventSlug}
/events/{eventSlug}/{occurrenceKey}

# Illustrative paths, not claims about existing records:
/events/example-gathering
/events/example-gathering/2027
/events/example-gathering/2027-weekend-2
```

The Event route identifies the enduring festival or gathering. The Occurrence route identifies one realization, including one of several weekends in the same year. Do not use a calendar year as a uniqueness rule or embed countries, venues, genres, or exact dates into the route hierarchy.

Keep the assigned `occurrenceKey` stable after publication, including after postponement, relocation, or a move across calendar years. A key that began as `2027` may remain so when corrected displayed dates fall in 2028. Display the accepted dates and edition label clearly; the key is an address, not the authoritative schedule. If an exceptional key correction is necessary, retain an alias redirect for the old path.

Use lower-case, URL-safe, hyphen-separated slugs and keys; retain original spelling and diacritics in displayed names. Resolve name collisions with a meaningful distinguishing slug or stable suffix, rather than changing Event identity. Reserve historical aliases permanently so a new Event cannot take another Event's published address. Use no trailing slash except at a host root.

### Page responsibilities and navigation

An Event page contains the durable name/description and links to its published Occurrences, including history. Its highlighted edition is selected deterministically: ongoing first, then earliest upcoming, with stable identifier tie-breaking. If neither exists, state that no upcoming edition is announced and link to published history. Do not present a cancelled, postponed, or historical edition as the next active one. Any edition-specific facts or classifications on this page identify the selected published Occurrence; do not combine facts across editions.

An Occurrence page contains edition dates/status, qualified location, relevant classifications, source-backed attendance details, and official links under the [information brief](003-festival-information.md). It links back to the durable Event and published sibling editions. Discovery result titles and map-result links point directly to this Occurrence route, not to an Event page that may highlight a different edition.

Selecting a list result or map marker loads that Occurrence's details on demand; its already-loaded summary may remain visible while details load. Standard links and direct navigation must work independently of the interactive map. A later drawer/modal enhancement must use the same route, preserve browser back behavior, and never create an alternative indexable detail URL.

Publication gates and uncertainty labels remain those of the domain model. Completed, cancelled, and already-published postponed Occurrences retain their pages and stable URLs even though cancellation/postponement excludes them from discovery. Drafts and withdrawn records expose no public detail payload; the proposed HTTP behavior is `404`, with internal audit history retained. A deleted/merged public identity redirects only when a confirmed replacement exists; never send unrelated missing pages to the homepage.

## 5. Cross-scope links, canonical URLs, and redirects

Each public Event and Occurrence has exactly one canonical absolute URL on its Event's home scope. An eligible result discovered on another scope links directly to that canonical address; the destination visibly identifies its home scope. A known public record requested at the equivalent path on another launched scope redirects permanently to its canonical host. The apex can likewise redirect a recognized detail path rather than serve another copy; unknown paths return `404`.

Scope roots are distinct discovery experiences and have their own canonical URLs. Do not canonicalize all scope roots to the apex or to Festivals. Shared about/privacy content is served only from the apex; scope navigation links directly to it.

Use permanent server redirects for old published slugs/keys, confirmed duplicate merges, explicit home-scope moves, HTTPS normalization, and configured host aliases such as `www.eventroam.com` to `eventroam.com`. Resolve aliases to the final current route in one redirect where practical; prevent loops. Preserve old published aliases indefinitely and never reuse them for another identity.

Redirect a known old slug together with its Occurrence suffix to the same Occurrence's current address. If a merge involved a conflicting key, resolve it using the stored identity/alias mapping rather than assuming the suffix matches on the surviving Event. Recheck public visibility before redirects or payload reads so aliases cannot expose a draft or withdrawn target.

Detail-page filter/view/tracking parameters do not alter identity or content; canonical and social URLs omit them. Do not copy arbitrary user-supplied redirect destinations. Scope changes initiated from discovery start at the destination root with defaults, since future scopes may have different filters; an Event link always preserves the selected identity.

## 6. Discovery URL state and responsive layout

Applied filter state belongs on the scope root as query parameters. The [discovery specification](004-discovery-filters.md#url-contract) owns the exact keys, normalization, validation, and unknown-value behavior. A representative URL is:

```text
https://festivals.eventroam.com/?from=2027-08-01&to=2027-08-31&country=PT&genre=electronic&view=map
```

Use `view=list` or `view=map` only as a narrow-screen presentation preference, with List as the proposed default. Both presentations remain visible at desktop widths regardless of this parameter. Preserve the preference when resizing, so returning to a small screen restores the selected view. Choose the responsive breakpoint during UI implementation based on usable map and list widths.

Switching views, panning, zooming, opening details, and returning with browser Back preserve the applied filters and the complete result set. Keep viewport and list scroll position in client/history state where practical; neither becomes a backend filter. No `bbox` parameter, map-area chip, viewport count, or viewport-based result restriction is supported.

Discovery uses lightweight summaries and coordinates when available. List and map consume the same complete filtered result set, with the map displaying its coordinate-bearing subset and explicit counts for records without map locations. Browser filtering is the proposed default described above. Full descriptions and practical details are fetched only when opened. Client rendering may cluster markers or virtualize visible rows, but must not silently truncate matches or invent paginated backend discovery.

Reload and browser back/forward restore applied URL state. Pending picker edits stay out of the URL. Direct detail URLs render a complete page without requiring a prior discovery request. Returning through browser history restores the prior discovery URL rather than reconstructing filters from the selected record.

## 7. Crawlability and indexing

Serve useful discovery list content, ordinary linked result titles, Event/Occurrence content, and page metadata from the server. The map enhances these links; it is not the only way to discover records. Event pages link to all their public editions so published historical pages remain reachable without a historical search query. Draft data and internal evidence/history never appear in public HTML, page data, or sitemaps.

Proposed indexing policy:

| Page class | Policy |
| --- | --- |
| Apex and launched scope roots | Indexable, self-canonical |
| Useful public Event and Occurrence pages | Indexable, canonical on home scope |
| Shared informational pages | Indexable on apex when substantive |
| Applied filter/search combinations | `noindex,follow`; exclude from sitemaps |
| View-only or tracking-only root variants | Canonical to the clean scope root; exclude variants from sitemaps |
| Invalid filter state, unavailable record, or unlaunched scope | Not indexable; never presented as an empty indexable catalog |

Filtered pages should use a normalized self URL with presentation/tracking parameters removed, alongside `noindex,follow`; do not assert that a materially filtered result is the same content as the unfiltered root. Invalid filter values produce the discovery spec's visible recovery state, not a silently broadened indexable response. Permit crawlers to retrieve pages carrying `noindex`; do not rely on `robots.txt` alone to express this indexing policy.

Each launched host serves its own `robots.txt` and sitemap, containing only its canonical, currently public URLs. The apex sitemap lists shared pages; each scope sitemap lists its root and the Events/Occurrences it canonically owns. Include retained historical, cancelled, and postponed public pages; remove withdrawn pages and never include redirects, filtered combinations, API routes, or placeholders. A future large sitemap may use an index without changing public content URLs.

Titles, descriptions, social metadata, and relevant structured data must describe the rendered record and accepted dates/status. Page URLs and structured-data identity URLs use the same canonical origin. Do not label historical or previous postponed dates as upcoming merely to populate metadata.

## 8. Acceptance and remaining work

Validate these behaviors when implementing routing and discovery:

1. Festivals opens on its scoped host; the apex links to it without duplicating the catalog. An unconfigured hostname does not open a default scope.
2. Desktop displays map and list together. Small screens switch easily without changing matches or filters. Moving the map makes no discovery request and changes no URL filter.
3. The summary response supports the complete matching set, including records without coordinates, under the selected delivery contract. Selecting a result loads the same Occurrence that its ordinary link identifies; direct visits render its full details.
4. Two weekends under one Event have separate durable URLs. Date moves preserve IDs, keys, and addresses; renames retain working redirects, including edition paths.
5. A cross-scope result uses one shared identity and canonical home-scope URL. An explicit home-scope migration redirects old URLs without duplicate indexable pages.
6. Public history remains linked and in the correct host's sitemap. Drafts and withdrawn records are absent from all public payloads and aliases; retained cancellations/postponements display their status.
7. Filter URLs round-trip through reload and history. View-only variants canonicalize to the root; actual filtered pages carry `noindex` and never enter sitemaps.
8. Canonical links, social URLs, sitemap entries, and redirect destinations come from configured origins and retained identity mappings.

Before implementation, incorporate the proposed routing attributes and alias constraints into the schema specification, select the small-screen default/breakpoint in UI design, and set up the actual launch domains/TLS. Measure summary payload size and rendering with the launch sample; an eventual need for a different delivery strategy requires an explicit revision, not an undocumented result cap.

Before adding another scope, specify its inventory, membership/filter rules, and the initial home-scope choice for overlapping records. Further landing pages and global discovery can be designed then. These decisions do not require finalizing agent execution in this iteration.

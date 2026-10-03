---
type: Reference
title: Website structure and URLs
description: Selected scope domains and current fixture-backed routes and discovery URL behavior.
status: deprecated
tags: [website, routing]
---

# Website structure and URLs

Historical source document. Its requirements were migrated to OpenSpec; use `openspec/specs/` for current behavior and `openspec/changes/` for approved future work.

Date: 2026-10-01

This document records the selected scope-domain direction and the routes and discovery behavior in the fixture-backed application. Unselected cross-scope and public-launch policies are in the [draft routing and indexing proposal](../../proposals/website-routing-and-indexing.md).

## 1. Confirmed direction and boundaries

Separate catalog scopes through subdomains, starting with `festivals.eventroam.com`. Future scopes can use domains such as `it.eventroam.com`. These are subject scopes, not languages or countries; all first-release public content remains English. Interpret `it` as information technology provisionally, pending the definition of that future scope.

The first release still covers open-air music festivals and burning-like gatherings under the [foundation](000-product-foundation.md). An example future domain does not add conferences or another vertical to this release. Agent execution and operation-interface decisions are deferred to the next iteration.

Discovery has two presentations of the same results: map and list. Show both together on desktop; provide an easy Map/List switch on smaller screens. The backend returns the complete discovery summary set, and full details load when a visitor opens a result. There is no “Search this area” action, bounding-box query, viewport-triggered result fetch, or result pagination. Moving the map changes only its presentation.

The current application returns all public discovery summaries for the active scope and filters them in the browser, with the same rules used for the server-rendered list on direct entry. The complete set includes matches without coordinates and enforces publication gates on the server. The [discovery specification](004-discovery-filters.md) owns filter semantics and summary delivery. This records implementation, not a separate owner approval of the delivery strategy.

## 2. Domains and site hierarchy

The current fixture-backed routes are:

| Host and path | Purpose | Release |
| --- | --- | --- |
| `eventroam.com/` | Apex directory of available scopes | Implemented |
| `festivals.eventroam.com/` | Festival discovery: filters, list, and map | Implemented |
| `festivals.eventroam.com/events/{eventSlug}` | Durable Event page with links to its published editions | Implemented |
| `festivals.eventroam.com/events/{eventSlug}/{occurrenceKey}` | One specific Occurrence and its full details | Implemented |

The apex is a scope directory, not a duplicate festival catalog or an automatic redirect. With only one launched scope, give Festivals a direct prominent link. Do not display empty future catalogs as active navigation destinations or publish indexable placeholder scope sites.

Each scope root is its discovery page; do not add synonymous `/map`, `/list`, `/search`, or `/festivals` routes. Proposed shared information pages and navigation for additional launched scopes are tracked in the [draft routing proposal](../../proposals/website-routing-and-indexing.md).

Country, city, genre, and date selections remain filters rather than path hierarchies. Curated editorial landing pages, global cross-scope search, localization, accounts, and submissions are deferred. No language prefix, year archive route, or country subdomain is needed for V1.

## 3. One application, shared identity, explicit scope

Use one application and shared catalog, with an explicit allowlisted mapping from host to scope. A scope configuration provides its host, public name, and discovery eligibility rules. The host selects a catalog scope; it does not select a separate database or create a new copy of an Event.

The Festivals scope uses the release eligibility rules already established in the foundation and taxonomy. Evaluate discovery membership per Occurrence using its own facts and classifications. A scope is a product/navigation concept, not a sixth taxonomy facet or an inherited Event classification. Define each future scope's membership rules and filters before launching it.

Retain globally unique Event slugs and shared Event/Occurrence IDs from the [domain model](001-domain-model.md). A record can eventually qualify for several scopes without being duplicated. The current schema stores `homeScope` on the Event and assigns `festivals` at first publication; all its Occurrences share that canonical host. This is URL ownership metadata, not a claim that every edition has the same classification.

For the current Festivals scope, every public Event has `homeScope = festivals`. Before launching overlapping scopes, define how to choose the initial home scope. Never recalculate an existing canonical host from current filters, genre edits, or a visitor's entry point. Proposed cross-scope migration and redirect behavior is in the [draft routing proposal](../../proposals/website-routing-and-indexing.md).

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

Publication gates and uncertainty labels remain those of the domain model. Completed, cancelled, and already-published postponed Occurrences retain their pages and stable URLs even though cancellation/postponement excludes them from discovery. Drafts and withdrawn records expose no public detail payload and return `404`, with internal audit history retained. Proposed merge redirect behavior is in the [draft routing proposal](../../proposals/website-routing-and-indexing.md).

## 5. Discovery URL state and responsive layout

Applied filter state belongs on the scope root as query parameters. The [discovery specification](004-discovery-filters.md#url-contract) owns the exact keys, normalization, validation, and unknown-value behavior. A representative URL is:

```text
https://festivals.eventroam.com/?from=2027-08-01&to=2027-08-31&country=PT&genre=electronic&view=map
```

Use `view=list` or `view=map` only as a narrow-screen presentation preference, with List as the current default. Both presentations remain visible at desktop widths regardless of this parameter. Preserve the preference when resizing, so returning to a small screen restores the selected view.

Switching views, panning, zooming, opening details, and returning with browser Back preserve the applied filters and the complete result set. Keep viewport and list scroll position in client/history state where practical; neither becomes a backend filter. No `bbox` parameter, map-area chip, viewport count, or viewport-based result restriction is supported.

Discovery uses lightweight summaries and coordinates when available. List and map consume the same complete filtered result set, with the map displaying its coordinate-bearing subset and explicit counts for records without map locations. Browser filtering is the current implementation described above. Full descriptions and practical details are fetched only when opened. Client rendering may cluster markers or virtualize visible rows, but must not silently truncate matches or invent paginated backend discovery.

Reload and browser back/forward restore applied URL state. Pending picker edits stay out of the URL. Direct detail URLs render a complete page without requiring a prior discovery request. Returning through browser history restores the prior discovery URL rather than reconstructing filters from the selected record.

## 6. Current discovery indexing behavior

The fixture-backed Festivals discovery page sets its canonical URL from the configured Festivals origin and normalized filter query. A view-only or tracking-only query canonicalizes to the clean scope root. A materially filtered query keeps its normalized filters in the canonical URL and emits `noindex,follow`; invalid filter state also emits `noindex,follow` with visible recovery feedback. These are implemented behaviors, not owner approval of a complete public indexing policy. Detail-page metadata, sitemaps, and host-level crawler rules remain in the [draft routing and indexing proposal](../../proposals/website-routing-and-indexing.md).

## 7. Acceptance and remaining work

The current fixture-backed routing and discovery behavior should remain true as the site develops:

1. Festivals opens on its scoped host; the apex links to it without duplicating the catalog. An unconfigured hostname does not open a default scope.
2. Desktop displays map and list together. Small screens switch easily without changing matches or filters. Moving the map makes no discovery request and changes no URL filter.
3. The summary response supports the complete matching set, including records without coordinates, under the selected delivery contract. Selecting a result loads the same Occurrence that its ordinary link identifies; direct visits render its full details.
4. Two weekends under one Event have separate durable URLs. Date moves preserve IDs, keys, and addresses; renames retain working redirects, including edition paths.
5. Filter URLs round-trip through reload and history. View-only variants canonicalize to the root; filtered and invalid states emit `noindex,follow`. Drafts and withdrawn records are absent from public payloads. The remaining canonical URL, redirect, and sitemap acceptance cases are in the [draft routing proposal](../../proposals/website-routing-and-indexing.md#acceptance-for-proposed-policies).

The current schema includes the `homeScope` routing attribute and the current UI defaults to List on small screens. Before public launch, set up the actual domains/TLS and measure summary payload size and rendering with the launch sample; an eventual need for a different delivery strategy requires an explicit revision, not an undocumented result cap. Remaining alias constraints are in the [draft routing proposal](../../proposals/website-routing-and-indexing.md).

Before adding another scope, specify its inventory, membership/filter rules, and the initial home-scope choice for overlapping records. Further landing pages and global discovery can be designed then. These decisions do not require finalizing agent execution in this iteration.

---
type: Proposal
title: Website routing and indexing defaults
description: Unselected cross-scope routing, canonical URL, redirect, and search indexing policies.
status: draft
tags: [website, routing, seo]
---

# Website routing and indexing defaults

These remaining rules were proposed in the [website structure specification](../005-website-structure-and-urls.md). Existing application behavior, including discovery canonical URLs and `noindex` responses, is documented there; implementation alone does not imply owner approval of the remaining choices.

## Site hierarchy and later scopes

Proposed pages and scopes beyond the current fixture-backed routes:

| Host and path | Purpose | Release |
| --- | --- | --- |
| `eventroam.com/about` | Shared explanation of the catalog, coverage, and uncertainty labels | V1 |
| `eventroam.com/privacy` | Shared privacy information reflecting the implemented site | Before public launch |
| `it.eventroam.com/` | Discovery for a future, separately specified IT scope | Deferred |

Scope navigation identifies the current scope and offers links to launched alternatives plus the apex. Shared informational pages live on the apex and are linked from each scope footer. Define each future scope's membership rules and filters before launching it; choose an initial home scope for overlapping records without changing existing IDs.

An explicit home-scope migration preserves the same IDs and redirects the old URLs. A deleted or merged public identity redirects only when a confirmed replacement exists; unrelated missing pages must not redirect to the homepage.

## Cross-scope links, canonical URLs, and redirects

Each public Event and Occurrence has exactly one canonical absolute URL on its Event's home scope. An eligible result discovered on another scope links directly to that canonical address; the destination visibly identifies its home scope. A known public record requested at the equivalent path on another launched scope redirects permanently to its canonical host. The apex can likewise redirect a recognized detail path rather than serve another copy; unknown paths return `404`.

Scope roots are distinct discovery experiences and have their own canonical URLs. Do not canonicalize all scope roots to the apex or to Festivals. Shared about/privacy content is served only from the apex; scope navigation links directly to it.

Use permanent server redirects for old published slugs/keys, confirmed duplicate merges, explicit home-scope moves, HTTPS normalization, and configured host aliases such as `www.eventroam.com` to `eventroam.com`. Resolve aliases to the final current route in one redirect where practical; prevent loops. Preserve old published aliases indefinitely and never reuse them for another identity.

Redirect a known old slug together with its Occurrence suffix to the same Occurrence's current address. If a merge involved a conflicting key, resolve it using the stored identity/alias mapping rather than assuming the suffix matches on the surviving Event. Recheck public visibility before redirects or payload reads so aliases cannot expose a draft or withdrawn target.

Detail-page filter/view/tracking parameters do not alter identity or content; canonical and social URLs omit them. Do not copy arbitrary user-supplied redirect destinations. Scope changes initiated from discovery start at the destination root with defaults, since future scopes may have different filters; an Event link always preserves the selected identity.

## Crawlability and indexing

Retain the server-rendered discovery list, ordinary linked result titles, and Event/Occurrence content as the public metadata and crawler policy is completed. The map enhances these links; it is not the only way to discover records. Event pages link to all their public editions so published historical pages remain reachable without a historical search query. Draft data and internal evidence/history must never appear in public HTML, page data, or sitemaps.

Remaining public-launch indexing policy:

| Page class | Policy |
| --- | --- |
| Apex and launched scope roots | Indexable, self-canonical |
| Useful public Event and Occurrence pages | Indexable, canonical on home scope |
| Shared informational pages | Indexable on apex when substantive |
| Applied filter/search combinations | Exclude from sitemaps; the current discovery page already emits `noindex,follow` |
| View-only or tracking-only root variants | Exclude variants from sitemaps; the current discovery page already canonicalizes them to the clean scope root |
| Invalid filter state, unavailable record, or unlaunched scope | Keep unavailable records and unlaunched scopes out of the index; the current discovery page already marks invalid filter state `noindex` |

Keep the current normalized self URL for materially filtered pages and their visible invalid-filter recovery state. Permit crawlers to retrieve pages carrying `noindex`; do not rely on `robots.txt` alone to express this indexing policy.

Each launched host serves its own `robots.txt` and sitemap, containing only its canonical, currently public URLs. The apex sitemap lists shared pages; each scope sitemap lists its root and the Events/Occurrences it canonically owns. Include retained historical, cancelled, and postponed public pages; remove withdrawn pages and never include redirects, filtered combinations, API routes, or placeholders. A future large sitemap may use an index without changing public content URLs.

Titles, descriptions, social metadata, and relevant structured data must describe the rendered record and accepted dates/status. Page URLs and structured-data identity URLs use the same canonical origin. Do not label historical or previous postponed dates as upcoming merely to populate metadata.

## Acceptance for proposed policies

- A cross-scope result uses one shared identity and canonical home-scope URL. An explicit home-scope migration redirects old URLs without duplicate indexable pages.
- Public history remains linked and in the correct host's sitemap. Drafts and withdrawn records are absent from all public payloads and aliases; retained cancellations/postponements display their status.
- Exclude view-only and filtered variants from sitemaps while retaining the current canonical and `noindex` behavior.
- Canonical links, social URLs, sitemap entries, and redirect destinations come from configured origins and retained identity mappings.

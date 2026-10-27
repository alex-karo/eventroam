---
type: Proposal
title: Website routing and indexing defaults
description: Remaining proposals for future pages, scopes, and routing beyond current website discoverability.
status: draft
tags: [website, routing, seo]
---

# Website routing and indexing defaults

The [website discoverability specification](../../openspec/specs/website/discoverability/spec.md) defines implemented metadata, indexing, and crawler behavior. The [scoped website specification](../../openspec/specs/website/routing/spec.md) owns host mapping, redirects, and discovery query rules. Remaining proposals below extend these contracts.

## Site hierarchy and later scopes

Proposed pages and scopes beyond the current fixture-backed routes:

| Host and path | Purpose | Release |
| --- | --- | --- |
| `eventroam.org/about` | Shared explanation of the catalog, coverage, and uncertainty labels | Separate future work |
| `eventroam.org/privacy` | Shared privacy information reflecting the implemented site | Separate future work |
| `it.eventroam.org/` | Discovery for a future, separately specified IT scope | Deferred |

Scope navigation identifies the current scope and offers links to launched alternatives plus the apex. Shared informational pages live on the apex and are linked from each scope footer. Define each future scope's membership rules and filters before launching it; choose an initial home scope for overlapping records without changing existing IDs.

An explicit home-scope migration preserves the same IDs and redirects the old URLs. A deleted or merged public identity redirects only when a confirmed replacement exists; unrelated missing pages must not redirect to the homepage.

## Cross-scope links, canonical URLs, and redirects

The existing two-host routing and the first-launch metadata policy remain in their owning OpenSpec documents. These proposals extend that baseline to future scopes, identity merges, and home-scope moves; they are not additional requirements for `public-site-launch`.

Each public Event and Edition has exactly one canonical absolute URL on its Event's home scope. An eligible result discovered on another scope links directly to that canonical address; the destination visibly identifies its home scope. A known public record requested at the equivalent path on another launched scope redirects permanently to its canonical host. The apex can likewise redirect a recognized detail path rather than serve another copy; unknown paths return `404`.

Scope roots are distinct discovery experiences and have their own canonical URLs. Do not canonicalize all scope roots to the apex or to Festivals. Shared about/privacy content is served only from the apex; scope navigation links directly to it.

Use permanent server redirects for old published slugs/keys, confirmed duplicate merges, explicit home-scope moves, HTTPS normalization, and configured host aliases such as `www.eventroam.org` to `eventroam.org`. Resolve aliases to the final current route in one redirect where practical; prevent loops. Preserve old published aliases indefinitely and never reuse them for another identity.

Redirect a known old slug together with its Edition suffix to the same Edition's current address. If a merge involved a conflicting key, resolve it using the stored identity/alias mapping rather than assuming the suffix matches on the surviving Event. Recheck public visibility before redirects or payload reads so aliases cannot expose a draft or withdrawn target.

Detail-page filter/view/tracking parameters do not alter identity or content; canonical and social URLs omit them. Do not copy arbitrary user-supplied redirect destinations. Scope changes initiated from discovery start at the destination root with defaults, since future scopes may have different filters; an Event link always preserves the selected identity.

## Crawlability and indexing

The [discoverability specification](../../openspec/specs/website/discoverability/spec.md) defines indexability, per-host crawler routes, metadata, supported Event JSON-LD, public visibility, and historical links. New content pages and curated country or genre landing pages remain separate future work; specify their indexing policy when their content and routes are selected.

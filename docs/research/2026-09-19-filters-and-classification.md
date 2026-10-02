---
type: Research
title: Rival filters and classification research
description: Dated rival research; its filter and inheritance recommendations were superseded.
status: stable
tags: [research, discovery]
---

# Rival filters and classification research

Research date: 2026-09-19. Status: recommendations for product selection, not an accepted implementation spec.

Update 2026-10-01: The owner selected a simpler classification model with fixed facets and Occurrence-only assignments. The [current domain model](../../specs/001-domain-model.md#53-occurrence-classification) and [festival taxonomy](../../specs/002-festival-taxonomy.md) supersede this report's Event-default/inheritance recommendations and tentative vocabulary. The rival observations below remain historical research.

## Recommendation

Start with **When, Where, Experience, and Music genre**, plus event-name search. Keep the first screen compact; preserve the same selection in the map, list, and URL. Include source-backed tentative dates by default with the required label. Separate musical style, outdoor setting, participatory culture, and official affiliation in the data model.

Camping is the strongest candidate for the next practical filter. Do not launch price, size, family suitability, accessibility, or alcohol-policy filters merely because rivals expose them: their definitions and available evidence are substantially weaker than dates and geography.

This follows the [foundation research brief](../../specs/000-product-foundation.md) and [current domain model](../../specs/001-domain-model.md). It supersedes the filter recommendations in the [initial scan](2026-09-14-competitor-scan.md), not the later product constraints. In particular, this report does not recommend public freshness indicators, approval queues, accounts, submissions, ticketing, or unattended ingestion.

## Method and limits

Three `gpt-5.6-luna` subagents researched broad directories, music discovery, and burn/psytrance communities. The coordinating agent reviewed their findings, checked key primary pages, tested one map's interactions, and profiled the three local source snapshots. All external links below were inspected or attempted on the research date; search-index versions can be older than the retrieval date.

Thirteen products were covered, including access-limited checks. The Burning Man directory is an authoritative specialist reference as well as a discovery alternative. Controls visible in a rendered page are distinguished from tested behavior, browse links, detail attributes, and intake fields. An access failure does not establish that a feature is absent. No authentication, purchases, or submissions were performed.

This is desk research, not interviews or usage analytics. User tasks and priorities below are hypotheses based on Eventroam's stated audience. Cross-filter semantics, mobile usability, and URL persistence were not exhaustively tested across every rival. The available JSON snapshots are candidate data, not a verified launch catalog or the still-unidentified eventmap database dump.

## Rival comparison

**C** = control observed; **B** = browse/landing route; **D** = displayed attribute; **T** = interaction tested; **U** = unverified in this pass. A control being present does not prove correct filtering or data quality.

| Rival and first-party source | Date and place discovery | Classification | Practical attributes and lesson |
| --- | --- | --- | --- |
| [FestivalFinder.eu](https://www.festivalfinder.eu/find-festival-organisations) | C: name, country, date period, city/region | C: topics, arts disciplines, institutional affiliations; musical styles appear alongside disciplines | C: daily price bands, surroundings, daily attendance, accommodation, transport, food, audience age, disability support. Strong breadth, but target age is not admission age and institutional labels are not event types. |
| [Festival Alarm](https://www.festival-alarm.com/us/Festivals-2026) | C: month, duration, country/state; searchable table | Setting and category controls; genre values also appear in rows and category landing pages | D: visitor count and starting price. Its [country-music category page](https://www.festival-alarm.com/us/Categories/Country-festivals/%28year%29/2026) explicitly distinguishes indoor, outdoor, and unknown. Available duration options depend on the inspected inventory. |
| [Festmap / GatherMap](https://festmap.org/) | C: name, country, year, month; map/globe views | C: experience categories mixing activities, cultural practices, and festival forms | C: family suitability and alcohol-free selection. Browser inspection succeeded although text retrieval failed; labels were largely Polish. Categories include yoga, workshops, and camping festivals. Do not confuse this site with unrelated products at festmap.net or gathermap.greenurbanist.org. |
| [Skiddle](https://www.skiddle.com/festivals/calendar/) | C: keyword, date bounds, UK-oriented geographic choices | C: musical styles and mixed categories covering programme, audience, and positioning | C: price ceiling, size, adult-only selection, facilities, activities, accommodation varieties. A valuable inventory of travel questions, but Eventroam should separate the meanings that its category labels mix. |
| [FestT](https://festt.io/en/festivals) | C: search, dates, location, sort; B: month/season/geography; [map](https://festt.io/en/carte) | Genre discovery through search and browse routes; detailed styles and lineup-derived shares on detail pages | Camping, price, and age controls were not verified in the inspected finder. Good browse architecture; weighted artist styles should not automatically become editorial classifications. |
| [Resident Advisor](https://ra.co/events) | C: distance and date; city-centered discovery | C: genre and event type; separates festivals from other electronic events | [RA Guide](https://ra.co/ra-guide) also advertises size and popularity. Age can appear on [event details](https://ra.co/events/2331577). Useful local-discovery model, with broader event scope than Eventroam. |
| [Music Festival Wizard](https://www.musicfestivalwizard.com/) | U: security challenge prevented current finder inspection | U | Prior scan found a rich submission form, but intake fields are not proof of public filters. Excluded from current feature-presence conclusions. |
| [Burning Man event finder](https://burningman.org/global-events-groups/find-a-burning-man-event/) | C: keyword, category, region; chronological listings | Cards distinguish regional events, decompressions, and Project events | Official-network scope and tentative-date labels are useful references. Network membership must not define eligibility for Eventroam's independent burning-like events. Exact dropdown options were not established merely from card labels. |
| [Goabase](https://www.goabase.net/en) | C: calendar, countries, local/radius discovery and detailed search | C: event shape and psytrance styles, including smaller subgenres | Festival and short outdoor-party categories have explicit duration/amenity meanings. Borrow the clarity of definitions, not their thresholds as universal festival rules. |
| [Psytrance Family](https://psytrancefamily.com/) | B: North American calendar embedded from Google; inner filter behavior U | Broad psytrance community scope; no reliable public facet inventory from accessible content | Event submission instructions are intake, not filters. A community-discovery reference with limited inspectable mechanics. |
| [Festival Networks](https://festivalnetworks.com/map.html) | C/T: month; genre/month combinations tested; map exploration | C/T: broad genre chips; more detailed styles in list text | D: page advertises camping, capacity, price, and travel information; those were not observed as map filters. Tested text list did not narrow with the map. |
| [Allfest](https://allfest.ru/) | C: region/city and date bounds | C: theme; B: geographic pages | Clear local calendar entry point. Exact date-overlap semantics and combinability were not tested. |
| [Festicket](https://festicket.com/guides/2026/europe) | B: country/year directories, including [France](https://festicket.com/guides/2026/europe/france/festivals) | B: genre-specific routes, e.g. [country music in Austria](https://festicket.com/guides/2026/europe/austria/country-festivals) | Useful browse routes; homepage failed retrieval. Do not count these routes as a verified interactive faceted finder. |

[EventsInRussia](https://eventsinrussia.com/events), from the earlier scan, was also rechecked. Its accessible response exposed too little to validate a current filter inventory; it is an additional access-limited reference, not part of the thirteen-product matrix.

### Interaction spot check

On Festival Networks, choosing electronic music produced a map count of 232; adding January reduced it to 1; switching the genre to Afrobeats with January retained reduced it to 0. The URL remained `/map.html`. The full text list stayed present, including nonmatching festivals. The zero-result state changed the count without an observed explanatory recovery message. This is one point-in-time test, not a claim about every interface the service offers. [Tested page](https://festivalnetworks.com/map.html).

A 390 × 844 viewport spot check showed a cramped map/filter presentation. It was not a full touch, keyboard, screen-reader, or device audit. For other rivals, mobile and back/forward behavior remain untested. The recommendations below are Eventroam design choices, not claimed universal rival behavior.

## User tasks and priority

| User task hypothesis | Required discovery behavior | Priority and data dependency |
| --- | --- | --- |
| “I can travel in August; show music festivals in Portugal or Spain.” | Multi-country selection, date interval, genre; ordinary linked results | P0: country/area and supported dates already required for publication; genres need editorial mapping. |
| “Find a burn-like gathering, including independent ones.” | Experience selection independent of music and official affiliation | P0: evidence-backed participatory-culture definition; a non-musical burn must remain discoverable. |
| “What is happening near my destination this weekend?” | Map-area search or locality search plus dates | P0: list remains usable when coordinates are absent. Exact radius/travel-time search can follow later. |
| “I know the festival name; find its next edition.” | Name search, stable Event page, deterministic next Occurrence | P0: use existing identity and schedule rules; no lineup or artist entity required. |
| “I need an event entirely inside my holiday.” | Clear interval semantics; optionally a containment mode | P1: overlap is the initial default; never imply that an overlapping festival fits completely. |
| “I want to camp for several days.” | Duration and on-site camping | P1: duration is derived; camping needs a defined occurrence-level field and official evidence. |
| “Can I attend with children or a wheelchair?” | Specific admission/access information and source links | Detail-first: important requirements, but vague family/accessibility booleans are insufficient. |
| “I have a limited budget or prefer small gatherings.” | Comparable admission cost or capacity | Defer filters until price basis and capacity/attendance semantics are reliable. |

P0 means recommended for the first release, not already accepted. P1 means the next useful addition after the initial catalog and query behavior are dependable. This ordering weighs task usefulness, source availability, ambiguity, and implementation cost; it is not a measured user-preference ranking.

## Classification recommendation

Preserve the existing controlled facets. A single tree combining music, outdoor setting, audience, and affiliation would make both filtering and ingestion ambiguous.

| Dimension | Proposed treatment | Rules |
| --- | --- | --- |
| Event type | Existing `event_type`; begin with festival and gathering where needed | A burn may be a festival or gathering. Do not make it mutually exclusive with music. Do not seed concerts/conferences solely because the generic model allows them. |
| Physical format | Existing `format`; outdoor and mixed indoor/outdoor are the relevant eligible values | Keep edition-specific evidence. Use an unambiguous public label for the model's example `hybrid`; do not confuse mixed indoor/outdoor with online participation. Primarily indoor music festivals remain out of scope. |
| Programme | Existing multi-valued `topic`, initially music and arts as supported | Having art or workshops alone does not make an event burning-like. Generic wellness retreats are not admitted by adding a topic. |
| Music | Existing multi-valued `genre`, shallow hierarchy | Use supported broad styles and selected subgenres. Genre absence does not exclude a non-musical participatory gathering. |
| Participatory culture | Proposed small `culture` facet, initially `burning-like` | This is a proposed addition to the concrete vocabulary/facet configuration, not a schema change made by this research. It enables overlap with music and avoids overloading physical format. |
| Official affiliation | Separate evidence-backed, occurrence-aware recognition if later displayed | Neither “burning-like,” an organizer's name, nor absence from a directory proves official or independent status. Unknown recognition remains unknown. |
| Logistics and policy | Typed occurrence facts or future feature models | Country, dates, duration, camping, age, price, capacity, accessibility, and alcohol rules are not taxonomy terms. |

**Working definition of burning-like:** a source-supported participatory gathering centered on co-created art/community, with explicit organizer description of a burn/Burning Man-inspired model or comparably documented practices such as gifting, participant contribution, and communal self-reliance. Music, camping, fire imagery, or “transformational” marketing alone is insufficient. Ambiguous cases remain unclassified and are reported by the research run. This definition needs a small sample of official and independent events before becoming an accepted editorial rule.

Official recognition has a separate process described by Burning Man's [Regional Events Committee](https://burningman.org/global-events-groups/burning-man-regional-network/regional-events-committee/). Treat that as evidence of recognition, not a definition of all participatory culture. Similarly, FestivalFinder's institutional labels and Skiddle's audience categories should not be imported into Eventroam's musical genre facet.

Expose **Experience** as a friendly filter over canonical classifications: music festivals; burns and participatory gatherings. These sets can overlap. An implementation spec must define the exact predicates; the proposed burn selection uses the supported culture assignment, not official recognition. Do not create a duplicate manually maintained “experience” field.

For music, start from a compact set of **candidate** roots: electronic, rock, metal, punk, pop, hip-hop/rap, folk, jazz, blues, soul/R&B, reggae, country, classical, and experimental. Expose only terms represented by verified launch inventory. Add house, techno, psytrance, drum & bass, and ambient beneath electronic when useful. This is a discovery vocabulary, not a universal musicological hierarchy; only true synonyms become aliases. Do not equate EDM with all electronic music, or all trance with psytrance.

Multiple supported genres describe mixed programming. Do not infer every genre from an artist roster, and do not use “multi-genre” or “other” as a substitute for missing knowledge. A broad-programme label could be added later with a clear definition. Keep untranslated/free-form source labels in evidence until mapped. Existing Occurrence-overrides-Event semantics remain authoritative; querying must use the effective complete facet set, not an accidental union of both levels.

## Data readiness

Read-only profiling on 2026-09-19 reproduced the local snapshot sizes. “Present” below means non-null/nonempty, including explicit `false`; it does **not** mean verified, normalized, complete, current, or suitable for publication. [Earlier source review](2026-09-17-source-model-review.md).

| Snapshot | Records | Place/date/classification presence | Practical-field presence and caveat |
| --- | ---: | --- | --- |
| `sources/festivalnetwork/data-api.json` | 769 | Country 769; each date endpoint 763; genre 769 | Camping 722, capacity 481, euro-labeled ticket price 577. Camping includes strings, booleans, six unconfirmed values, and a qualified tent-only value. |
| `sources/festmap/festivals.json` | 474 | Country 473; start 466; end 434; tags 470; categories 461 | Family and alcohol booleans present in all 474 rows, without evidence that every negative is verified. Family: 20 true, 454 false; alcohol-free: 387 true, 87 false. |
| `sources/festt/festivals.json` | 500 returned members | Country, both dates, and nonempty genres in all 500 | Capacity in 0; minimum price 314; maximum price 242. There are 1,158 distinct genre slugs, with 1–197 genre assignments per row. Response metadata says 890 total, so this is a partial response. |

These counts argue for a small curated vocabulary and against importing boolean defaults or hundreds of styles as reliable filters. Festmap categories mix languages and dimensions, including workshops, music, community, wellness, and regional-burn claims. Festival Networks has composite genre strings that require mapping. The data does not establish comparable price basis or attendance semantics.

The eventmap database dump was not identified in this pass. Therefore legacy-field coverage remains unresolved; the three snapshots are not presented as that dump. Official-source refresh remains necessary for every published candidate. Null/missing/unknown must never become “no,” zero cost, zero attendance, no age restriction, or an exact location.

## Proposed filter and map/list contract

These are recommendations to transfer into a feature spec after selection, not implementation changes in this report.

1. **When:** month shortcuts with an explicit year and a custom inclusive date interval. Default to upcoming and ongoing eligible Occurrences. Interval matching means overlap: `occurrence.start <= requested.end && occurrence.end >= requested.start`. An event spanning 30 July–2 August matches August. A containment option, if added, must be explicitly labeled. Use event-local calendar dates, not a UTC midnight conversion. Do not include camping/build windows or flatten separate weekends.
2. **Where:** multi-country selection, locality/region search, and explicit “Search this area” on the map. Panning alone should not silently change results. A selected map area intersects other filters and has a removable chip. Avoid a home-country-relative “overseas” category in a worldwide catalog. Start without geolocation permissions or route-time computation.
3. **Experience and genre:** OR within each user-selected dimension, AND across dimensions. Musical parent terms include their descendants. Assignment cardinality is separate from query cardinality: a single-valued stored facet can still accept several alternatives in a search. Selecting a music genre excludes unknown/nonmatching genres; “Any genre” does not exclude non-musical burns.
4. **Tentative dates and status:** retain tentative dates by default, labeled wherever shown. A secondary confirmed-dates-only control is inexpensive because date state already exists. Keep postponed and cancelled records out of default upcoming discovery; preserve their public pages under existing rules. No primary status menu is needed initially, and no new unknown-date public results are introduced.
5. **Shared results:** filter Occurrences first; do not let an Event's earliest unfiltered edition hide a later matching edition. List cards and map features refer to matching Occurrences and link to stable pages. The map is the coordinate-bearing subset of the eligible list. Show counts such as “12 results · 10 mapped · 2 without a map location.” Approximate points remain qualified. With an explicit geographic bounding box, an unlocated record cannot be assumed inside it; explain the constraint and provide a way to clear it.
6. **URL state:** serialize meaningful selections with stable keys/slugs and normalized dates; restore on reload and back/forward. An illustrative contract is `?from=2027-08-01&to=2027-08-31&country=PT&country=ES&genre=electronic`. This is not an implemented route. Preserve active zero-result selections; never silently broaden them. Show removable chips, reset, and a clear suggestion to remove one constraint.
7. **Mobile and accessibility:** keep when/where prominent; place other controls in a labeled filter panel with selected values and an Apply action. Switching map/list must preserve state. Provide keyboard-operable controls, focus restoration, announced result counts, reduced motion, and accessible links for each result. Do not depend on dragging the map or tiny genre chips.
8. **Indexing:** shared filter URLs need not all be indexed. Keep arbitrary combinations and map bounds out of indexable landing-page generation. Curated geographic or genre pages can follow once they have meaningful inventory and the canonical/noindex rules are specified.

## Practical filters to stage later

| Candidate | Recommendation | Required evidence and semantics |
| --- | --- | --- |
| Duration | P1, low data cost | Inclusive programme-day count, not nights or venue opening window; display the date range alongside it. |
| Camping | First new practical field/filter | Define on-site camping permitted/available for this Occurrence, distinct from nearby accommodation and whether included in admission. Use yes/no/unknown plus qualifications; only supported yes matches a positive filter. Campervan/glamping distinctions can follow. |
| Outdoor versus mixed | Optional secondary selector | Already needed for scope; add a public control only if users need to distinguish substantial mixed programmes from fully outdoor ones. |
| Family suitability / age | Detail-first | Separate minimum age, guardian conditions, and programme suitability. A kids' area or all-ages admission does not certify a family-friendly experience. |
| Accessibility | Detail-first, specific provisions | Preserve official access guidance and concrete facilities/limitations. Avoid a single “accessible” checkbox based on an unrelated feature. |
| Price / free admission | Defer numeric filter | Need currency, ticket scope, fees, tier, conditions, and edition relevance. A free activity does not make the festival free; never compare daily admission with a full pass. |
| Size | Defer until basis is comparable | Distinguish licensed capacity, daily attendance, total visits, and estimates. Do not mix them into arbitrary size buckets. |
| Alcohol-free, sustainability, atmosphere | Defer | Require explicit policy or defined criteria; absence of bars is not an alcohol ban, and marketing labels do not prove sustainability or social suitability. |
| Official regional recognition | Optional detail later | Verify the relevant network/edition. Independent and unknown-affiliation events remain eligible when their format is supported. |
| Artist matching, popularity, personalization | Outside first release | Additional entities, accounts, or opaque ranking are unnecessary to answer the core travel tasks. |

## Next decisions and validation

The next implementation specification should settle the Experience predicates and burn definition, choose the verified starter genre terms, and document the query/URL contract. Measure actual official-source coverage on the launch dataset before enabling any new practical filter; report known yes, known no, unknown, and conflicts separately. No coverage threshold is claimed from this research.

Before release, test overlap at month/year boundaries, tentative dates, cancelled/postponed exclusion, effective Occurrence taxonomy, parent-genre matching, OR/AND combinations, multiple matching editions, unlocated results, map bounds, URL restoration, and empty-result recovery. Include a real narrow-screen and keyboard journey. Validate the task hypotheses with travelers and local visitors; the present report contains no user interviews.

No application code, schema, source snapshots, or reference-project files were changed by this research.

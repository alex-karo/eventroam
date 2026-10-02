# Source data and domain-model review

Date: 2026-09-17  
Scope: Read-only review of the three files under `sources/` plus a small set of current official festival sources. This is a model review, not source verification or an import plan.

Update 2026-10-01: The [current domain model](../../specs/001-domain-model.md#53-occurrence-classification) now uses Occurrence-only classifications without Event inheritance or overrides. That decision supersedes this review's classification-override recommendation; the source observations remain historical context.

## Outcome

The current Event/Occurrence split, date uncertainty, approximate-location handling, external links, taxonomy, and evidence/audit records cover the essential shape well. Five changes are justified now:

1. Require a country plus a supported locality/region for publication. A place name without a country is ambiguous in a worldwide catalog.
2. Allow classification at Occurrence level with deterministic override semantics. Outdoor/hybrid scope and other edition facts are not always permanent Event properties.
3. Preserve the final inspected URL and source authority with checked-source results and applied-change evidence. A mutable Source record must not rewrite the historical meaning of evidence.
4. Define occurrence dates as public programme dates and explicitly reject campsite, gate, accommodation, ticket-sale, build, or strike windows. Treat a fallow year as absence, not cancellation.
5. Represent a source's date-only publication label without inventing a midnight timestamp.

These findings informed the domain model. Its current design keeps Source and CatalogChange records without a persisted source-check result entity; a separate Observation entity is deferred.

Do not add ticket products, lineups, artists, transport, accommodation, or media solely because the dumps contain them. They remain valid later features, but none is necessary to identify and publish the first coherent catalog slice.

## Local source snapshots

### `sources/festivalnetwork/data-api.json`

- 769 flat records with names, dates, country/area, coordinates, genres, scale, capacity, one price, website, camping and travel hints; only 110 include `img`.
- Date input is heterogeneous: most values use abbreviated textual dates, 72 use ISO dates, 13 use a `TBC` year/month expression, and 6 have no start date. The raw value belongs in evidence; only exact supported pairs belong in published Occurrences.
- `Camping` mixes strings, booleans, null, `unconfirmed`, and a qualified value (`Yes (tent camping only)`). This is extraction input, not a safe boolean domain field.
- Capacity and price are often absent and their semantics are not documented. `capacityEstimate` must not be populated as attendance, and a bare numeric price is not a ticket product.
- The Wacken record uses 30 July–1 August 2026, while the official campground page gives a wider 26 July–2 August operating window. This is a concrete example of why ancillary dates must not replace festival dates.

### `sources/festmap/festivals.json`

- 474 records with localized country/region text, dates, tags/categories, two audience booleans, links, confidence, and coordinates.
- 121 records have neither a website nor Facebook URL, so the dump alone cannot provide current publication evidence.
- Three records use `[0, 0]` for unknown coordinates. The domain model correctly rejects this sentinel.
- Confidence is a property of this dataset's row (`304 HIGH`, `117 MEDIUM`, `53 LOW`), not a substitute for field-level evidence or Eventroam validation.
- Examples show classification noise and geocoding risk. Imported tags and confidence should stay in process output or import evidence until mapped and verified.

### `sources/festt/festivals.json`

- The response says `totalItems: 890` but contains 500 members, proving that importers must honor pagination rather than treating one response as the complete source.
- Records contain dates, place text, coordinates, country/region, prices, capacity, poster, ticket/website links, headliners, genre trees, similarity hints, and data-quality flags.
- 204 of the 500 returned members carry `missing_geocode`, yet coordinates may still be populated; one example pairs Thessaloniki with Paris coordinates. Coordinates require independent validation and an explicit precision/derivation, not just non-null checks.
- Headliners, weighted genre paths, posters, affiliate URLs, and HTML FAQ copy are outside the first-release model. They should not be copied into canonical summaries or taxonomy without a dedicated feature and provenance rules.

None of the three files carries sufficient retrieval time, inspected URL, and source authority metadata to count as current publication evidence. They are candidate inputs only.

## Official-source examples

The following examples were sampled to challenge the model, not to certify or import the events:

- [Glastonbury's official information page](https://www.glastonburyfestivals.co.uk/info/?direct=true) states that the next festival is 23–27 June 2027 and explicitly says there is no 2026 festival because it is a fallow year. No cancelled 2026 Occurrence should be invented. The same page contains ticket-sale, campsite, car-park and arrival dates that are not the festival date pair.
- [Burning Man Project's official event finder](https://burningman.org/events/) mixes single-day and multi-day events, labels some future dates as tentative, and distinguishes Regional Events from Burning Man Project events. It validates `LocalDate` ranges and provisional dates, while showing that external recognition must be evidence-backed and occurrence-aware.
- [Primavera Sound's official site](https://www.primaverasound.com/pt?pass=1) lists Barcelona, Porto, Buenos Aires, and São Paulo editions with different dates and venues. These are separate durable Events under the product's identity rule, not one Event whose location changes several times in a year.
- [Kiwiburn's official event page](https://kiwiburn.com/the-event/) provides dates, a locality/country, and the annual theme “Moss & Microchips.” The theme fits an Occurrence `displayName`; it should not rename the recurring Event. Its [official date announcement](https://kiwiburn.com/news/kiwiburn-2027-dates/) displays a publication date without a time, which must remain a `LocalDate` rather than becoming an invented instant.
- [AfrikaBurn's official ticket page](https://tickets.afrikaburn.org/) provides exact dates, named site, country, coordinates, gate hours, and ticket variants. [Its event guide](https://www.afrikaburn.org/wp-content/uploads/2025/04/WTF_OOTB-2025_single-pages.pdf) describes a site spanning two farms. The first-release primary-site snapshot remains adequate for map discovery, but exact public location and event dates must be distinguished from gate operations.
- [Wacken's official campground page](https://www.wacken.com/en/camping/woa-campground/) publishes a campground window wider than the music-festival programme. A parser matching only the event name and nearby dates could create the wrong Occurrence range.

## Model implications and deferrals

| Observed data | Decision now | Reason |
| --- | --- | --- |
| Edition-specific outdoor/hybrid presentation | Add Occurrence classification overrides | Scope eligibility is evaluated per edition. |
| Country, region/locality, and approximate coordinates | Require country plus area; keep coordinates optional and qualified | Prevent globally ambiguous pages and false map precision. |
| Redirects and changing source authority | Preserve final URL and authority in process output and CatalogChange evidence | Preserve what evidence meant when accepted. |
| Date-only source publication label | Retain the date-only label in evidence without inventing an instant | Preserve source precision without inventing midnight or a timezone. |
| Festival dates mixed with gate/camping/sales dates | Add a date-boundary invariant | Prevent plausible but materially wrong ranges. |
| Fallow year | Represent no Occurrence | Absence is not cancellation. |
| Annual theme | Use optional Occurrence `displayName` | Already representable without a new searchable field. |
| Multiple farms or satellite venues | Keep one primary location in v1 | Enough for discovery; multi-venue itinerary behavior is not yet required. |
| Prices and ticket URLs | Keep ExternalLink only; defer ticket products | A scalar price loses currency, tier, fees, eligibility, and availability. |
| Capacity/scale | Retain optional estimate cautiously | Source meaning varies between capacity, attendance, and marketing scale. |
| Camping, family, alcohol, accessibility, sustainability, transport | Defer pending filter/task research | These need definitions, unknown semantics, and often occurrence-level evidence. |
| Posters, images, lineups, FAQ HTML | Defer | They require rights, lifecycle, sanitization, and/or additional entities. |

## Follow-up questions for later specs

- If ticketing enters scope, model offers with currency, fees, audience/eligibility, sales windows, availability state, and official seller identity; do not add `priceMin`/`priceMax` alone.
- If accessibility or camping becomes a filter, define whether it describes the core venue, included admission, optional accommodation, or merely available nearby.
- If official network affiliation is displayed publicly, add an evidence-backed recognition relationship with validity/occurrence semantics. Do not encode it as a timeless Event tag.
- Revisit multiple active venues only when the list/detail/map experience needs to expose them, rather than merely storing a combined primary site name.

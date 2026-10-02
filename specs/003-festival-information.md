# Festival information to extract

Date: 2026-10-01 · Status: V1 information brief

Implementation note (2026-10-02): Source evidence collection and storage described below are deferred until the catalog database update workflow is built. Current catalog writes do not accept evidence payloads.

Collect information about each dated edition (Occurrence); keep enduring names and descriptions on the Event. Follow the [domain model](001-domain-model.md) for identity, evidence, publication, and writes, and the [taxonomy](002-festival-taxonomy.md) for classification. The [filter spec](004-discovery-filters.md) selects what visitors can filter.

## Core information

- **Identity:** official name, aliases, short factual English description, edition year/title, official website, social links, and ticket-information link. Preserve original proper names.
- **Dates:** first and last public programme dates, confirmed/tentative state, and cancellation/postponement status. Exclude camping, gate, build, and ticket-sale windows. Separate discontinuous weekends; derive duration as inclusive programme days.
- **Location:** country, locality/region, venue, public address, coordinates and their precision, and time zone when known. Country plus a supported area is required; exact coordinates are optional. Label approximate locations and respect unpublished venue details.
- **Classification:** event type, physical format, programme topics, music genres, and burning-like culture, supported for this edition. Missing genres are valid for non-musical gatherings. Setting and culture remain useful facts even without public filters; burning-like does not imply official affiliation.
- **Size:** maximum or planned attendee capacity for this edition, stored as `capacityEstimate`, with source wording and an estimate label where appropriate. Require a positive supported integer. Do not substitute total visits, past attendance, generic venue occupancy, campsite capacity, or remaining tickets. Preserve source ranges as evidence; do not invent midpoints.
- **Ticket availability:** store `unknown` (default), `available`, or `sold_out` per edition. Require an explicit organizer/authorized-seller statement for edition-wide sell-out; a sold-out tier, day, or campsite is insufficient. Keep source/check evidence and support later reopening. Sold-out events remain listed with a badge; this is separate from cancellation and is not a v1 filter.

## Prices: original currency, no filter

Try to find adult general admission for the full programme. Retain day tickets or packages when that is all the source provides, clearly identifying their scope.

Store the original amount and currency code, whether it is exact/from/a range, ticket coverage, tier, eligibility, sales window, known availability, fees/tax inclusion or uncertainty, mandatory extras, and official link. Unknown currency stays as source wording; do not guess from a symbol. Distinguish optional extras, discounts, VIP, and sold-out/expired offers. Do not invent per-person package prices or all-in totals when charges are unknown.

Free admission needs explicit evidence for the full programme; distinguish optional donations, deposits, conditional offers, and free side events. Missing price never means free. Display material qualifications and do not present expired offers as available.

Use a bounded typed price summary, to be added to the domain/storage contract before implementation. No conversion, price filtering/sorting, or complete ticket inventory is required.

## Additional details to attempt

- **Camping:** on-site availability/prohibition/unknown, tent/campervan restrictions, charges, and dates; distinguish nearby accommodation.
- **Admission age:** minimum age, guardian conditions, and child-ticket rules; avoid inferred “family-friendly” labels.
- **Accessibility:** specific provisions, limitations, and official guidance/contact; avoid one universal boolean.
- **Travel and participation:** official transport guidance, compulsory shuttles, required supplies/contributions, and explicit policies such as alcohol restrictions.

These are optional event details, not publication gates or v1 filters. Use qualified text and links; any new structured fields need an explicit typed contract. Lineups, media, sustainability scores, formal affiliation, and accommodation inventories remain deferred.

## Collection rules

Prioritize publication facts, then genre and capacity, then prices and practical details. Prefer edition-relevant official sources. Retain inspected URL, authority, retrieval time, and supporting excerpt/snapshot under the domain contract; existing dumps are leads, not current verification.

Unknown never means no or zero. Previous editions are leads, not inherited facts. Failed checks, missing extraction, and unresolved conflicts preserve accepted values and produce run results. Refreshes remain owner-initiated and changes audited.

Extend the taxonomy's roughly 30-event validation sample across countries, currencies, sizes, and musical/non-musical events. Report usable capacity, other size measures, unknowns, and conflicts separately, alongside price coverage and qualifications. Missing optional information must not block publication.

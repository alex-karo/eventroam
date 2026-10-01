# Product foundation: first release

Status: Draft; product direction confirmed by the owner on 2026-09-17  
Scope: First-release behavior, acceptance, and rollout

## 1. Context and outcome

Eventroam aims to catalog events of any type worldwide for locals and international travelers. The English-language first release starts with open-air music festivals and burning-like events; coverage need not be complete at launch. Include independent burning-like gatherings, even without a defining music programme; do not imply official Burning Man affiliation without evidence. Include mixed indoor/outdoor festivals with a substantial outdoor programme, but exclude primarily indoor festivals with incidental outdoor activity. Preserve original proper names; full localization is deferred.

The first release combines a crawlable list and Event/Occurrence pages with an interactive map over the same records. Desktop shows map and list together; narrow layouts offer two easily switched views. The backend returns complete discovery summaries, with full details loaded on selection. Map movement does not filter or fetch a geographic subset; there is no “Search this area” action. Parallel recurring festivals under one brand in different countries/locations are separate Events; one festival relocating between years keeps its identity. Brand grouping is deferred.

Separate scope domains organize the website, starting with `festivals.eventroam.com`; `it.eventroam.com` is a future scope, not an expansion of the first release. The [website structure and URL specification](005-website-structure-and-urls.md) documents proposed page hierarchy, routes, and domain behavior.

The owner uses an agent to research, discover, refresh, edit, and publish through validated application interfaces. Both discovery and source checks are manually initiated in the first release. An apply run writes and publishes eligible records directly, with source evidence, duplicate checks, atomic audit history, and a run summary; no per-item or batch approval, Proposal entity, or review UI is required. Incomplete records remain drafts. No public freshness indicator is shown, but the owner can retrieve internal field-change history through the agent.

Publication requires source-backed dates, a country, and at least a supported approximate locality/region within it. Provisional dates are allowed with “Tentative dates” wherever displayed. Qualify an approximate location; an exact venue or coordinates are not required. A published postponed Occurrence keeps its page and previous-date history but leaves upcoming discovery. An Event page requires at least one published current or historical Occurrence. The [domain model](001-domain-model.md) defines these gates and all record invariants.

Scheduled or unattended runs, public submissions, accounts, ticketing, travel booking, lineups, and personalization are outside this release. [ADR 001](../docs/decisions/001-sqlite-and-drizzle.md) records the database choice; command/API contracts and physical layout still need implementation specifications.

### Initial import and agent interfaces

Inspect the eventmap dump read-only before implementing import; document its format, legacy IDs, date/location semantics, and source URLs. Its location and contents are not yet established. Import candidates as drafts with stable legacy-to-Eventroam mappings. Repeated import must not duplicate records, overwrite newer verified values or owner corrections, or replace historical Occurrences. Refresh facts against online sources before publication: legacy data is not current verification.

Provide versioned, validated operations for import, discovery, refresh, direct edit, publication, and history retrieval. Agent execution design, exact command names, transport, and error/conflict codes are deferred to the next planning iteration by the owner on 2026-10-01; the domain's write/evidence invariants remain required. Prefer official sources; retain canonical URLs, retrieval times, and bounded evidence. Failed checks preserve accepted facts. Runs report checked, created, updated, published, unchanged, skipped, and failed outcomes with stable identifiers. Retries are idempotent; source conflicts and ambiguous matches are skipped and reported without review tasks. Retrieval time alone does not establish fact verification.

### Discovery decisions

The [discovery specification](004-discovery-filters.md) selects When, Where, Music genre, Duration, and Size, alongside event-name search, and owns map/list behavior and query state. It supersedes the earlier recommendations in the [initial competitor scan](../docs/research/2026-09-14-competitor-scan.md) and [filters/classification research](../docs/research/2026-09-19-filters-and-classification.md). The [festival information brief](003-festival-information.md) distinguishes collected details from public filters, including original-currency prices without price filtering. Validate international trip planning and local discovery, mobile use, date ranges, unknown values, combined filters, URL state, empty results, and source-backed coverage against the dump and refreshed launch data. The [festival taxonomy](002-festival-taxonomy.md) defines starter terms, not additional public controls.

## 2. Domain contract

The [domain model](001-domain-model.md) owns Event, Occurrence, venue, taxonomy, sources, direct-write and audit contracts, and publication/query rules. This document owns release scope and end-to-end outcomes. Keep domain rules in the model rather than repeating them here.

## 3. End-to-end acceptance scenarios

The first release is complete when these flows work without placeholder facts:

1. A manually initiated agent apply run uses source evidence to create an Event, Occurrence, location, classifications, and official link. Eligible records publish without review; catalog and audit writes commit atomically. The same Occurrence appears in the list, on the map when coordinates exist, and at stable Event/Occurrence URLs.
2. Rechecking unchanged content records an unchanged result but no catalog or field-change duplicate; replaying a completed check does not duplicate its result. A failed check retains accepted public facts and is visible in the run summary.
3. A supported date, venue, or cancellation change updates the same Occurrence, retains old/new values in audit history, and is highlighted in the run summary. A dry run shows the diff without catalog mutation. A new year's announcement creates another Occurrence under the existing Event.
4. Unknown dates keep an Occurrence draft. Source-backed provisional dates can publish with “Tentative dates” on every date display; later confirmation changes the date state and audit history without changing identity. A published postponement without replacement dates retains its public page, displays “Postponed — new dates TBA” and labeled previous dates, and leaves upcoming results.
5. Publication rejects missing country or locality/region. A supported approximate area may publish without a venue or coordinates, with a qualification in list/detail views; map display additionally requires valid representative coordinates and precision. An Event with no published Occurrence is not public, while an Event with published history remains public.
6. Ambiguous identities, conflicting sources, invalid extraction, and lower-confidence claims against owner corrections leave affected values unchanged and produce attributable skipped/failed results, including potential matches and reasons. No approval task is created.
7. Repeated eventmap import creates no duplicate Events/Occurrences; imported facts remain drafts until refreshed evidence passes publication gates. Owner-initiated discovery matches, validates, and publishes eligible new festivals; incomplete ones stay drafts.
8. The owner retrieves runs and field history through the agent, including old/new values, UTC apply time, actual writer, initiating owner, and evidence. No-change checks add no field-change entry. Public pages show uncertainty labels but no freshness indicators.
9. Parallel festivals under one brand remain distinct Events, while a documented relocation preserves identity. Substantial outdoor programming is eligible; incidental outdoor activity at a primarily indoor festival is not.
10. A stale version rejects a write; replaying an applied operation adds no audit entry. A later legitimate change back to an earlier value succeeds under a new operation key. Each Occurrence owns its classification set: copying a prior edition seeds only a draft, publication needs applicable evidence, and changes never propagate to other editions or Event defaults. Public Event pages display terms from the selected published Occurrence only.

## 4. Remaining release decisions

Resolve these before implementing dependent behavior: dump location/field mapping; validation of discovery defaults and starter vocabulary against launch data; idempotent vocabulary loading; typed price/practical-detail storage; snapshot retention; and proposed website/URL defaults. Agent execution and command/API contracts, including conflict codes, wait for the next planning iteration. Filter scope, complete discovery summaries with on-demand details, responsive map/list presentation, and scope domains are selected. Publication edge cases and internal history are defined in the [domain model](001-domain-model.md).

## 5. Test approach and rollout

Cover the scenarios above with focused domain, persistence, route, and end-to-end checks using saved, attributable source fixtures rather than live third-party pages. Inspect the dump, create reviewed schema migrations, dry-run import, and validate a small refreshed sample before processing remaining in-scope records. Keep imported data out of schema migrations and leave the eventmap project unchanged. Release readiness requires the public site plus manually invoked discovery and refresh to work together under Docker Compose.

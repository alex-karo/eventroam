# Eventroam competitor scan

Date: 2026-09-14

## Scope

This is an initial product and data-model review of ten festival-discovery rivals:

- [Festmap](https://festmap.org/)
- [Allfest](https://allfest.ru/) (Russian)
- [EventsInRussia](https://eventsinrussia.com/) (Russian)
- [Festicket](https://festicket.com/)
- [Skiddle Festivals](https://www.skiddle.com/festivals/)
- [Music Festival Wizard](https://www.musicfestivalwizard.com/)
- [Festival Alarm](https://www.festival-alarm.com/us/)
- [Festival Networks](https://festivalnetworks.com/)
- [FestT](https://festt.io/en)
- [FestivalFinder.eu](https://www.festivalfinder.eu/)

The review focuses on discovery, filters, event pages, occurrence modeling, provenance, submissions, and ideas relevant to Eventroam's first vertical slice. Counts and site behavior are point-in-time observations and should not be treated as permanent facts.

## Summary

| Rival | Product model | Best idea to study | Main weakness to avoid |
| --- | --- | --- | --- |
| Festmap | Map-first festival discovery | Spatial browsing and confidence indicators | Modal-only discovery, weak crawlability, and unclear provenance |
| Allfest | Editorial festival directory | Regional and thematic landing pages with practical visitor details | Generic editorial copy and weak durable event identity |
| EventsInRussia | National event calendar | Visible source attribution and structured venue metadata | Repeated dates flattened into one continuous range |
| Festicket | Programmatic festival directory | Stable routes and country/year/genre landing pages | Factual inconsistency in generic or reused copy |
| Skiddle | Ticket marketplace and festival guide | Rich venue, access, age, and FAQ information | Multiple occurrences summarized as one broad date range |
| Music Festival Wizard | Curated music-festival guide and planner | Reviewed submissions, corrections, and detailed intake fields | Planning and personalization features would expand the MVP too early |
| Festival Alarm | Community-supported festival database | Year-by-year history, explicit unknowns, and evidence requests for corrections | No clear canonical Event page separate from annual pages |
| Festival Networks | Curated European guide with an AI concierge | Natural-language discovery and a manually reviewed submission promise | Festival facts lack public provenance and can conflict with official sources |
| FestT | Lineup-driven discovery and compatibility scoring | Artist-to-festival matching, map/list integration, and rich facet pages | Generated editorial and travel content can contradict structured data |
| FestivalFinder.eu | European arts-festival directory and professional network | Explicit organization/edition model with approval and historical editions | Some recurring schedules are intentionally flattened into broad date ranges |

## Findings by rival

### Festmap

Festmap currently presents itself as GatherMap, with an emphasis on conscious and transformational gatherings. Its primary interface is a globe/map with search and filters for country, month, year, category, family friendliness, and alcohol-free events. It also displays confidence indicators and offers an authenticated submission flow.

The site's [public festival endpoint](https://festmap.org/api/festivals) exposed 474 events across 42 countries during this review, of which 283 included a website. The sample also contained conspicuous coordinate errors, including Vancouver at approximately `55.3439, -106.2173` and Córdoba at approximately `-39.5169, -62.5777`. Public records do not expose a supporting source or verification timestamp.

Its [sitemap](https://festmap.org/sitemap.xml) listed only the homepage during this review, and event information is presented primarily in map modals rather than stable public event routes. The experience is visually attractive but provides poor crawlability, provenance, and map/list parity.

Ideas to study:

- Immediate spatial exploration.
- Focused filters that reflect the audience rather than a generic category list.
- A visible confidence signal when facts are incomplete.

Risks to avoid:

- Making the map the only meaningful discovery surface.
- Publishing coordinates without reviewable evidence.
- Treating confidence as a substitute for source attribution.

### Allfest

Allfest is a Russian editorial portal combining a festival directory, news, and long-form guides. The homepage exposes filters for region, city, theme, and date. A typical [festival detail page](https://allfest.ru/festival-2026/mezhdunarodnyy-festival-molodyozhi) includes dates and time, venue, description, program, transport guidance, tickets, tags, and related content.

The site makes extensive use of [regional and thematic landing pages](https://allfest.ru/r/festivali-v-rossii), internal links, and practical information that helps a visitor move from discovery to attendance.

Ideas to study:

- Indexable location and taxonomy landing pages.
- Practical transport, admission, and program information on detail pages.
- Strong internal linking between related festivals and guides.

Risks to avoid:

- Generic SEO copy presented alongside sourced facts without distinction.
- Important source information buried in prose.
- Annual pages that do not preserve a durable Event identity across Occurrences.

### EventsInRussia

EventsInRussia is a broad national calendar. Its [events catalogue](https://eventsinrussia.com/events) reported 26,163 events across 85 regions during this review.

The strongest pattern is explicit provenance. A typical [event page](https://eventsinrussia.com/events/30941) names the contributing tourism information centre and links to its source. Pages also structure age restrictions, language, venue, and tags.

The main modeling concern is repeated schedules. For example, a knight tournament held every Friday from May through September is represented as one continuous date range. That is convenient for a summary card but loses the distinction between separate scheduled realizations.

Ideas to study:

- Show the responsible source or contributing organization publicly.
- Structure venue, audience, language, and classification fields.
- Support large geographic catalogues without making the map mandatory.

Risks to avoid:

- Converting a recurrence rule or list of dates into a misleading continuous range.
- Treating a contributed listing as verified without recording when and how it was checked.

### Festicket

Festicket uses a programmatic directory model with country, year, and genre pages; stable festival routes; live and past states; countdowns; date and location details; UTC offsets; and sections such as About, Media, Lineup, tickets, and contact information. Its [France 2026 guide](https://www.festicket.com/guides/2026/europe/france/festivals) listed 193 festivals during this review.

This creates many useful discovery paths and gives each festival a durable, shareable destination. However, the scale and templating can expose factual inconsistencies. In one reviewed listing, copy for a Richmond, Virginia event referred to the historic Colorado Territory, indicating likely reused or insufficiently reviewed text.

Ideas to study:

- Stable, readable festival URLs.
- Crawlable country, year, and genre combinations when they contain meaningful inventory.
- Clear state distinctions for upcoming, live, and past events.

Risks to avoid:

- Publishing generic or generated descriptions as factual evidence.
- Producing thin index pages for every possible filter combination.
- Allowing presentation copy to contradict structured location data.

Example detail page: [Highfield Festival 2026](https://festicket.com/festivals/highfield-2026/34547/about).

### Skiddle

Skiddle combines ticket sales with an extensive festival guide. The [festival directory](https://www.skiddle.com/festivals/) supports location and month search, categories, editorial news, an A–Z index, and event submission through its [Promotion Centre](https://promotioncentre.co.uk/).

The [Coachella page](https://www.skiddle.com/festivals/coachella/) demonstrates the strengths of a commercial guide: a durable URL, dates, venue, genres, lineup status, travel information, age guidance, FAQs, and trust signals.

It also demonstrates an occurrence-modeling trap. The summary shows a single April 9–18 range while the FAQ explains that the festival runs over two separate weekends. Eventroam should preserve those scheduled realizations explicitly instead of implying an uninterrupted ten-day Occurrence.

Ideas to study:

- Practical venue, travel, admission, accessibility, and age information.
- Clear calls to action without hiding the informational page.
- A guided organizer submission workflow.

Risks to avoid:

- Letting ticketing concerns determine the core catalogue model.
- Collapsing multiple weekends or sessions into one continuous Occurrence.
- Requiring a purchase flow to access useful event facts.

### Music Festival Wizard

Music Festival Wizard offers a deep music-fan experience built around curated festival guides, artist tracking, and personal schedules. Its [schedule application](https://schedule.musicfestivalwizard.com/) organizes performances by day, stage, and time.

The site's [festival submission form](https://docs.google.com/forms/d/e/1FAIpQLSffrvkwfAF00Wu_TDQG5R__L5r834G7sJbvD2vlrzINBVtOwA/viewform?usp=sf_link) asks for an official website, dates, location, description, lineup, capacity, venue, genre, camping, age restrictions, and social profiles. A separate [correction route](https://linktr.ee/musicfestivalwizard) gives visitors a way to report inaccurate information.

Ideas to study:

- Separate submission and correction paths.
- Collect the official source before accepting descriptive details.
- Use a detailed intake form as a proposal for human review.
- Later, artist schedules can enrich mature festival data.

Risks to avoid:

- Adding personalized planning, artist tracking, and schedule-building before the public catalogue is reliable.
- Assuming submitted descriptions or lineup claims are evidence without checking official sources.

The current [Android application](https://play.google.com/store/apps/details?id=com.mfw.festivalwizard) also illustrates how the product extends beyond the public website, but that scope is not necessary for Eventroam's MVP.

### Festival Alarm

Festival Alarm is a long-running, German-centred festival database with English-language pages and wider European coverage. Its [2026 catalogue](https://www.festival-alarm.com/us/Festivals-2026) is a crawlable table rather than a map-only interface. It supports filters for month, duration, indoor/outdoor setting, category, and country or German state, while exposing dates, genres, location, attendance, and price directly in the results.

Its strongest domain pattern is the relationship between a festival and its annual dates. The [Wacken Open Air 2026 page](https://www.festival-alarm.com/us/Festivals-2026/Wacken-Open-Air-Mittwoch-29.-Juli-2026-Wacken) links every recorded edition from 2010 through 2026. Missing venue, ticket, lineup, and travel values are displayed as unknown instead of being filled with guesses. The map also uses attendance bands in its marker legend, a compact way to communicate scale.

Community contribution is unusually low-friction: visitors can add a festival without registering. For corrections, the [contact form](https://www.festival-alarm.com/us/Contact-form/%28request_node%29/8134) explicitly asks for an evidence URL. Detail pages identify the publisher and provide a correction link.

Ideas to study:

- Keep a crawlable, information-dense list alongside the map.
- Link annual Occurrences into a visible Event history.
- Display unknown values honestly and consistently.
- Require a supporting URL for corrections.
- Consider a visual scale encoding for attendance, while retaining accessible text equivalents.

Risks to avoid:

- Using annual URLs without a clearly addressable canonical Event page.
- Treating a general disclaimer as a substitute for fact-level sources and verification times.
- Accepting anonymous submissions without a review queue, deduplication, and abuse controls.

### Festival Networks

Festival Networks is a curated European music-festival guide combining a [map](https://festivalnetworks.com/map.html), editorial guides, artist alerts, and a natural-language concierge. During this review, its map reported 754 festivals across 39 countries and offered genre and month filters. Importantly, it renders a full text list below the map, although festival entries link directly to official sites instead of stable internal festival detail pages.

The homepage demonstrates a compelling discovery interaction: a visitor can ask for something like “metal, August, camping” and receive a short list without first learning the site's filter taxonomy. Artist-follow alerts provide another discovery path. The [submission form](https://festivalnetworks.com/submit-festival.html) collects name, country, city or region, official website, dates, price, expected attendance, genre, description, and a private contact email. It promises manual review, no automatic approvals, and updates by email.

The main concern is data confidence. The homepage listed Glastonbury as a June 2026 festival even though the [official Glastonbury site](https://www.glastonburyfestivals.co.uk/info/?direct=true) states that 2026 is a fallow year and the next event is in 2027. Festival Networks' own guide catalogue also describes Glastonbury 2027 as following the 2026 fallow year. No supporting source or last-checked time is shown beside the incorrect homepage fact.

Ideas to study:

- Translate natural-language intent into ordinary, inspectable filters.
- Let people follow an artist and learn when that artist joins a festival lineup.
- Manually review organizer submissions and set a response expectation.
- Render a real list beneath a map for accessibility and crawlability.

Risks to avoid:

- Returning concierge answers from stale catalogue facts.
- Publishing editorial claims without public provenance.
- Sending map and list visitors away to official sites without an indexable Event/Occurrence page.
- Letting featured placement affect the perceived trustworthiness of facts.

### FestT

FestT is a music-festival discovery product organized around artists, lineups, genres, and a proposed compatibility score called FestiScore. Its homepage describes a score composed of favorite-artist coverage, dominant-genre coverage, and stylistic coherence. Spotify import was marked as coming soon during this review, while manual preference selection was available.

The product has strong public information architecture. It provides stable festival pages, a [world map](https://festt.io/en/carte) whose pins lead to those pages, and indexable routes by country, region, city, month, season, genre, and subgenre. Event pages can include complete lineups, calculated genre shares, comparison and follow actions, playlists, accommodation, transport, weather, nearby activities, descriptions, and FAQs. The [Musikfest 2026 page](https://festt.io/en/festivals/musikfest-2026), with hundreds of artists, shows the depth of its artist-to-festival relationship model.

This richness also exposes a validation problem. On the [October 2026 landing page](https://festt.io/en/festivals/mois/octobre-2026), the structured heading reported 220 upcoming festivals while the narrative said FestT tracked 167. The [Meh Stuff! page](https://festt.io/en/festivals/meh-stuff-2026) described one confirmed artist in its About copy, reported four artists in Practical Info, and used the festival name itself as the city. Its travel section then generated generic airport, road, and public-transport guidance from that weak location record.

Ideas to study:

- Model artists and festival appearances explicitly enough to support lineup search and comparison.
- Make every map marker lead to a stable, content-rich page.
- Create useful country, region, month, season, genre, and subgenre routes from real inventory.
- Later, offer explainable taste matching rather than an opaque recommendation score.

Risks to avoid:

- Generating travel advice until the venue and coordinates pass validation.
- Producing narrative catalogue counts separately from the query that renders the list.
- Allowing derived genre, lineup, or recommendation data to appear more trustworthy than its underlying observations.
- Prioritizing personalized scoring before basic source-backed facts are dependable.

### FestivalFinder.eu

FestivalFinder.eu, operated by the European Festivals Association, is the closest reviewed rival to Eventroam's intended domain model. Its [registration guidance](https://www.festivalfinder.eu/how-to) explicitly separates a durable festival organization from festival editions. Organizers create a new edition from scratch or copy a previous one, and every new edition is subject to approval by the FestivalFinder.eu Secretariat. Past editions remain visible; organizers must contact the team to correct an archived edition.

The [festival search](https://www.festivalfinder.eu/festivals) reported 3,886 festivals during this review. Beyond name, country, and dates, it filters by topics, EFA affiliation and quality labels, art discipline, price per day, surroundings, daily attendance, accommodation, transport, food, target age group, and disability support. Festival pages expose an official website, organizer identity, other editions, and structured practical attributes.

There are two important modeling and validation lessons. First, its [edition instructions](https://www.festivalfinder.eu/add-next-edition) recommend representing a concert held every Friday for three months as the full first-to-last date range. That preserves the broad programme window but obscures the actual scheduled dates. Second, the reviewed [FUSA Dance Festival page](https://www.festivalfinder.eu/festivals/fusa-dance-festival) showed Paris and 14–19 September 2026 in structured fields while its description said the next edition would be in New York City in August 2026. Approval of an edition therefore does not guarantee that promotional prose agrees with its structured facts.

Ideas to study:

- Separate the durable festival identity from each dated edition.
- Let an organizer copy a previous edition without overwriting history.
- Approve new editions before publication and restrict silent edits to archived editions.
- Support multiple locations and separate organization-level from edition-level URLs.
- Consider accessibility, transport, setting, audience, and food as useful structured facets.

Risks to avoid:

- Flattening intermittent programmes into continuous date ranges.
- Assuming an institutional label or approval implies current field-level accuracy.
- Copying stale promotional descriptions into a new edition without cross-field validation.
- Making every rich intake field mandatory in the MVP.

## Product opportunity for Eventroam

None of the ten reviewed products clearly combines all four of these properties:

1. A useful map with an equivalent crawlable list.
2. Stable pages for both durable Events and dated Occurrences.
3. Explicit source provenance and verification time for important facts.
4. Honest treatment of unknown, repeated, moved, postponed, and cancelled dates.

That combination is a credible initial differentiation for Eventroam.

## Patterns to borrow

- **Festmap:** immediate spatial discovery and focused filters.
- **EventsInRussia:** visible source attribution.
- **Allfest and Festicket:** indexable regional, date, and taxonomy landing pages.
- **Skiddle:** practical venue, travel, access, and age information.
- **Music Festival Wizard:** reviewed submissions and a dedicated correction path.
- **Festival Alarm:** linked annual history, explicit unknowns, and evidence-backed corrections.
- **Festival Networks:** natural-language discovery translated into a small result set.
- **FestT:** artist/lineup relationships and strong map-to-detail-page navigation.
- **FestivalFinder.eu:** a durable festival plus approved edition model and rich practical facets.

## Patterns to avoid

- Map-only event modals with no stable routes.
- Invented, generic, or unsourced descriptions.
- Placeholder dates or coordinates presented as facts.
- Flattening repeated schedules or separate weekends into one continuous range.
- Building ticketing, personalization, or itinerary features before the catalogue and review workflow are trustworthy.
- Generating narrative, travel, or recommendation content from unverified structured fields.
- Treating moderation, an institutional label, or a confidence score as a replacement for source-level evidence.

## Implications for the first vertical slice

The first Eventroam slice should demonstrate the differentiation directly:

- Render a server-side event list and stable Event/Occurrence pages from the same query used by the map.
- Show the official source and last verification time on every published Occurrence.
- Represent multiple scheduled realizations separately, even when a rival summarizes them as a range.
- Keep unknown dates and locations explicitly unknown.
- Provide a small reviewed submission or correction path before attempting automated publication.
- Create only filter landing pages that contain useful, non-duplicative content.
- Validate descriptions and derived content against structured dates and locations before publication.
- Preserve an occurrence's individual dates even when a source summarizes an intermittent programme as one range.
- Accept organizer submissions as Candidates, and retain their supplied official URL as evidence for review.

## Candidates for the next review batch

- Songkick
- Bandsintown
- Resident Advisor
- Everfest

## Research limitations

- This was a surface-level product review, not a traffic, business-model, or technical-architecture audit.
- Some homepages limited automated access, so the review also used accessible first-party detail pages, public endpoints, forms, and application listings.
- Catalogue counts and available features may change after the review date.
- Observed data-quality issues are examples, not estimates of each catalogue's overall accuracy.

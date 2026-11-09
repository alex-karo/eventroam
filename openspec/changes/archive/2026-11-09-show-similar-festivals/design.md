# Design

## TL;DR

The Event route loads alternatives after it resolves the public Event. The catalog read uses the Event's published history and the genre tree to return up to three matches, each from a different festival. The Event view shows the returned cards before Edition history.

## Contracts

Proposed result and catalog read. An empty result means the Event view omits the section. [Existing public types](../../../../src/catalog/read/contracts.ts)

```ts
type SimilarFestival = {
  edition: DiscoverySummary;
  sharedGenreName: string;
};

declare function similarFestivals(
  client: Database.Database,
  event: PublicEvent,
  now: Date,
): SimilarFestival[];
```

## Architecture

1. The Event page calls the alternatives read after `requestDetail` resolves the Event and handles redirects. Keep this call in the page render so metadata and Edition requests use their existing read path. [Event route](../../../../src/app/events/%5Bslug%5D/page.tsx)
2. The server request helper opens a read-only database, passes `requestNow()` to the catalog read, and closes the connection in `finally`. Put the selection in `catalog/read/similar-festivals.ts` and pass its result to `EventDetailsPage`. [Server request helper](../../../../src/site/server/public-request.ts) · [Event view](../../../../src/features/event-details/event-page.tsx)

## Key decisions

### Source and candidate data

Choose the source from `event.editions`. Use `isPastEdition` with each Edition's time zone and the request time. Take the current or future Edition with the earliest start date. If all have ended, take the one with the latest start date. The source can be cancelled or postponed because its genre describes the festival the visitor is replacing. [Public Event read](../../../../src/catalog/read/public-catalog.ts) · [Date rules](../../../../src/catalog/domain/dates.ts)

Share the public summary row query and the batch genre lookup with discovery. Add two conditions to the alternatives query. Exclude rows for the source Event and rows with a stored `soldOutSourceUrl`. Discovery uses its existing query conditions and result shape. [Discovery read](../../../../src/catalog/read/discovery.ts)

Read the candidate rows and the genre tree in one short transaction. In the same transaction, load the genre slugs for the source and all candidate Edition IDs in one batch. Include the source ID even if discovery would omit that Edition.

### Match order

1. For the source and each candidate, include the assigned genre slugs and follow `parentSlug` to the root. Use the deepest common genre. Depth is the number of parent links from that genre to its root. A source with no genres gives an empty result.
2. Scan candidates in start-date order. Use `isPastEdition` to skip ended Editions. Keep the first Edition with a match for each `eventSlug`. For a festival with two matching Editions, the earlier Edition supplies the card and its match strength.
3. Sort these matches by genre depth, deepest first. Use a stable sort to keep matches of equal depth in start-date order. Return at most three matches with the display name of each shared genre.

### Event cards

Render the card list directly in `EventDetailsPage`, before `EditionHistory`. Use `edition.eventName` as the link text and `editionPath(edition.eventSlug, edition.key)` as its destination. Show `sharedGenreName` as the reason for the match. [URL helpers](../../../../src/site/site.ts)

Use `Dates` for the date range, duration, and tentative label. Require only `startsOn`, `endsOn`, `status`, and `dateState` in its `edition` prop so it can also render a `DiscoverySummary`. Use `placeName` for the place. [Dates component](../../../../src/components/catalog/catalog.tsx) · [Formatters](../../../../src/components/catalog/format.ts)

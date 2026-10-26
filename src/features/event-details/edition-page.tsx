import { DateBlock } from "@/components/catalog/date-block";
import { SiteHeader } from "@/components/site/site-header";
import type { PublicEvent, PublicEdition } from "@/catalog/read/contracts";
import { isPastEdition } from "@/catalog/domain/dates";
import { eventPath } from "@/site/site";
import { withDiscovery } from "@/site/discovery-context";
import { BackToResults } from "@/components/catalog/back-to-results";
import { EditionHistory } from "@/components/catalog/edition-history";
import { ExternalLinks } from "@/components/catalog/external-links";
import { basePrice } from "@/components/catalog/format";
import {
  Dates,
  Location,
  Status,
  TicketPrice,
  TicketCategories,
  Terms,
  Size,
} from "@/components/catalog/catalog";
import { LocationMap } from "./location-map";

export function EditionDetailsPage({
  event,
  edition,
  token = null,
  now = new Date(),
}: Readonly<{
  event: PublicEvent;
  edition: PublicEdition;
  token?: string | null;
  now?: Date;
}>) {
  const located = edition.latitude !== null && edition.longitude !== null;
  const past = isPastEdition(edition, now);
  const mapLink = {
    kind: "map",
    url: `https://www.google.com/maps/search/?api=1&query=${edition.latitude},${edition.longitude}`,
    label:
      edition.coordinatePrecision === "exact"
        ? "Open location"
        : "Open approximate location",
  };
  return (
    <>
      <SiteHeader />
      <main className="catalog festival-details">
        <nav aria-label="Festival navigation">
          <BackToResults token={token} /> /{" "}
          <a href={withDiscovery(eventPath(event.slug), token)}>{event.name}</a>
        </nav>
        <header>
          <div className="edition-title">
            <DateBlock date={edition.startsOn} />
            <h1>{edition.name ?? `${event.name} ${edition.year}`}</h1>
          </div>
          <Status edition={edition} now={now} />
          <Dates edition={edition} />
          <Location edition={edition} />
          {edition.venueAddress && <p>{edition.venueAddress}</p>}
          <Terms edition={edition} />
          <Size edition={edition} />
          <TicketPrice edition={edition} now={now} />
          <div className="detail-actions">
            <ExternalLinks
              links={edition.links}
              historicalYear={past ? edition.year : undefined}
            />
            {located && <a href="#location">Show on map</a>}
          </div>
        </header>
        {event.summary && (
          <section>
            <h2>About the festival</h2>
            <p>{event.summary}</p>
          </section>
        )}
        <section>
          <h2>Tickets</h2>
          {past &&
            (basePrice(edition) || edition.ticketCategories.length > 0) && (
              <p>Prices for this edition</p>
            )}
          <TicketCategories edition={edition} now={now} />
          {!basePrice(edition) && !edition.ticketCategories.length && (
            <p>Ticket information not available</p>
          )}
          {basePrice(edition) && !edition.ticketCategories.length && (
            <TicketPrice edition={edition} now={now} />
          )}
        </section>
        <section id="location">
          <h2>Location</h2>
          <Location edition={edition} />
          {edition.venueAddress && <p>{edition.venueAddress}</p>}
          {located && (
            <>
              <ExternalLinks links={[mapLink]} />
              <LocationMap
                latitude={edition.latitude!}
                longitude={edition.longitude!}
                precision={edition.coordinatePrecision}
              />
            </>
          )}
        </section>
        <section>
          <h2>Other editions</h2>
          <EditionHistory
            editions={event.editions}
            currentId={edition.id}
            token={token}
          />
        </section>
      </main>
    </>
  );
}

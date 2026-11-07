import { DateBlock } from "@/components/catalog/date-block";
import { SiteHeader } from "@/components/site/site-header";
import type { PublicEvent, PublicEdition } from "@/catalog/read/contracts";
import { isPastEdition } from "@/catalog/domain/dates";
import { festivalDescription } from "@/site/festival-description";
import { eventPath } from "@/site/site";
import { EditionHistory } from "@/components/catalog/edition-history";
import { ExternalLinks } from "@/components/catalog/external-links";
import { Icon } from "@/components/catalog/icons";
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
  now = new Date(),
}: Readonly<{
  event: PublicEvent;
  edition: PublicEdition;
  now?: Date;
}>) {
  const located = edition.latitude !== null && edition.longitude !== null;
  const past = isPastEdition(edition, now);
  const price = basePrice(edition);
  const summary = event.shortDescription?.trim();
  const bookingLinks = edition.links.filter(
    ({ kind }) => kind === "ticketing" || kind === "official_site",
  );
  const otherLinks = edition.links.filter(
    ({ kind }) => kind !== "ticketing" && kind !== "official_site",
  );
  const primaryLink =
    (!past &&
      edition.status !== "cancelled" &&
      edition.status !== "postponed" &&
      bookingLinks.find(({ kind }) => kind === "ticketing")) ||
    bookingLinks.find(({ kind }) => kind === "official_site");
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
      <main className="catalog festival-details edition-details">
        <header className="edition-opening">
          <div className="edition-title">
            <DateBlock date={edition.startsOn} />
            <div className="edition-heading">
              <h1>{edition.name ?? `${event.name} ${edition.year}`}</h1>
              <Terms edition={edition} />
            </div>
          </div>
          <div className="edition-overview">
            <div className="edition-facts">
              <Status edition={edition} now={now} />
              <Dates edition={edition} />
              <div className="edition-place">
                <Location edition={edition} showPrecision />
                {located && <a href="#location">Show on map</a>}
              </div>
              {summary && <p className="edition-summary">{summary}</p>}
              <Size edition={edition} />
            </div>
            <aside
              className="edition-booking"
              aria-labelledby="edition-booking-heading"
            >
              <h2 id="edition-booking-heading">
                {past ? "Prices for this edition" : "Tickets"}
              </h2>
              {price ? (
                <TicketPrice edition={edition} now={now} showLabel={false} />
              ) : (
                <p className="edition-price-missing">
                  {edition.ticketCategories.length > 0
                    ? "Price not available"
                    : "Ticket information not available"}
                </p>
              )}
              <ExternalLinks
                links={bookingLinks}
                historicalYear={past ? edition.year : undefined}
                primaryUrl={primaryLink?.url}
              />
              {edition.ticketCategories.length > 0 && (
                <a className="edition-ticket-details" href="#tickets">
                  Ticket categories and terms
                </a>
              )}
            </aside>
          </div>
        </header>
        <section>
          <h2>About the festival</h2>
          <p>{festivalDescription(event)}</p>
        </section>
        {edition.ticketCategories.length > 0 && (
          <section id="tickets">
            <h2>Ticket categories</h2>
            {past && <p>Prices for this edition</p>}
            <TicketCategories edition={edition} now={now} />
          </section>
        )}
        <section id="location">
          <h2>Location</h2>
          <Location edition={edition} showPrecision />
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
        <section aria-labelledby="other-editions-heading">
          <h2 id="other-editions-heading">Other editions</h2>
          <EditionHistory editions={event.editions} currentId={edition.id} />
          <a
            className="edition-festival-link"
            href={eventPath(event.slug)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open festival page in a new tab"
          >
            Festival overview <Icon name="new-page" />
          </a>
        </section>
        {otherLinks.length > 0 && (
          <section>
            <h2>More links</h2>
            <ExternalLinks
              links={otherLinks}
              historicalYear={past ? edition.year : undefined}
            />
          </section>
        )}
        <footer className="privacy-footer">
          <a href="/privacy">Privacy policy</a>
        </footer>
      </main>
    </>
  );
}

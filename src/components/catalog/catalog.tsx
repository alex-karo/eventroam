import type { PublicEdition } from "@/catalog/read/contracts";
import { durationDays, isPastEdition } from "@/catalog/domain/dates";
import { Icon } from "./icons";
import { basePrice, categoryPrice, dateRangeParts, placeName } from "./format";
export { linkLabel } from "./external-links";

export function Dates({ edition }: Readonly<{ edition: PublicEdition }>) {
  const days = durationDays(edition.startsOn, edition.endsOn);
  const [first, last] = dateRangeParts(edition.startsOn, edition.endsOn);
  return (
    <p className="fact">
      <Icon name="calendar" />
      <span className="date-facts">
        {edition.status === "postponed" && (
          <>
            <strong>Postponed — new dates TBA. </strong>Previous dates:{" "}
          </>
        )}
        <span className="date-range">
          <time dateTime={edition.startsOn}>{first}</time>
          {edition.endsOn !== edition.startsOn && (
            <>
              –<time dateTime={edition.endsOn}>{last}</time>
            </>
          )}
        </span>
        {edition.dateState === "provisional" && (
          <span className="date-badge">Tentative dates</span>
        )}
        <span className="fact-duration">
          {days} {days === 1 ? "day" : "days"}
        </span>
      </span>
    </p>
  );
}
export function Location({ edition }: Readonly<{ edition: PublicEdition }>) {
  const located = edition.latitude !== null && edition.longitude !== null;
  return (
    <p className="fact">
      <Icon name="place" />
      <span>
        {placeName(edition)}
        {located &&
          edition.coordinatePrecision !== "exact" &&
          " · Approximate location"}
        {!located && (
          <>
            {" "}
            <span className="location-note" title="Map location unavailable">
              · Not mapped
            </span>
          </>
        )}
      </span>
    </p>
  );
}
const statusLabels = {
  cancelled: "Cancelled",
  postponed: "Postponed",
  announced: "Announced",
  scheduled: "Scheduled",
};
export function Status({
  edition,
  now = new Date(),
}: Readonly<{ edition: PublicEdition; now?: Date }>) {
  return (
    <p className={`edition-state state-${edition.status}`}>
      {statusLabels[edition.status]}
      {isPastEdition(edition, now) && " · Past edition"}
    </p>
  );
}
const availabilityLabels = {
  available: "Available",
  sold_out: "Sold out",
  closed: "Ticket sales closed",
};
export function TicketCategories({
  edition,
  now = new Date(),
}: Readonly<{ edition: PublicEdition; now?: Date }>) {
  if (!edition.ticketCategories.length) {
    return null;
  }
  const past = isPastEdition(edition, now);
  return (
    <ul className="ticket-categories">
      {edition.ticketCategories.map((category, index) => {
        const availability = category.availability;
        const showStatus =
          availability &&
          availability !== "unknown" &&
          !(past && availability === "available");
        return (
          <li key={`${category.label}:${index}`}>
            <div className="ticket-category-heading">
              <strong>{category.label}</strong>
              <span>{categoryPrice(category)}</span>
            </div>
            {showStatus && (
              <span className="ticket-status">
                {availabilityLabels[availability]}
              </span>
            )}
            {category.terms && <p>{category.terms}</p>}
          </li>
        );
      })}
    </ul>
  );
}
export function TicketPrice({
  edition,
  now = new Date(),
}: Readonly<{ edition: PublicEdition; now?: Date }>) {
  const price = basePrice(edition);
  if (!price) {
    return null;
  }
  return (
    <p className="fact">
      <Icon name="ticket" />
      <span>
        {isPastEdition(edition, now) ? "Prices for this edition" : "Tickets"}:{" "}
        <strong className="price-amount">{price}</strong>
        {edition.priceCoverage && edition.priceCoverage !== "full_programme"
          ? ` (${edition.priceCoverage.replaceAll("_", " ")})`
          : ""}
        {edition.priceQualification && (
          <small className="price-qualification">
            {edition.priceQualification}
          </small>
        )}
      </span>
    </p>
  );
}
export function Terms({ edition }: Readonly<{ edition: PublicEdition }>) {
  return edition.terms.length > 0 ? (
    <ul className="fact-tags" aria-label="Festival types and music">
      {edition.terms
        .toSorted(
          (a, b) => Number(b.facet === "genre") - Number(a.facet === "genre"),
        )
        .map((term) => (
          <li
            className={term.facet === "genre" ? "term-genre" : "term-general"}
            key={`${term.facet}:${term.name}`}
          >
            {term.name}
          </li>
        ))}
    </ul>
  ) : null;
}
export function Size({ edition }: Readonly<{ edition: PublicEdition }>) {
  return edition.sizeEstimate !== null ? (
    <p className="fact">
      <Icon name="people" />
      <span>
        Estimated size: {edition.sizeEstimate.toLocaleString("en")} people
      </span>
    </p>
  ) : null;
}

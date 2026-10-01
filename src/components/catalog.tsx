import type { PublicOccurrence } from "../application/public-catalog";
import { editionPath } from "../application/public-site";

export function Dates({ edition }: { edition: PublicOccurrence }) {
  const format = (date: string) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  return (
    <p>
      {edition.status === "postponed" && (
        <strong>Postponed — new dates TBA. </strong>
      )}
      {edition.status === "postponed" && "Previous dates: "}
      {edition.dateState === "provisional" && "Tentative dates: "}
      <time dateTime={edition.startsOn}>{format(edition.startsOn)}</time>
      {edition.endsOn !== edition.startsOn && (
        <>
          {" "}
          – <time dateTime={edition.endsOn}>{format(edition.endsOn)}</time>
        </>
      )}
    </p>
  );
}
export function Location({ edition }: { edition: PublicOccurrence }) {
  const place = [
    edition.venueName,
    edition.locality,
    edition.administrativeArea,
    edition.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <p>
      {place}
      {!edition.venueName && " · Approximate location"}
      {!edition.hasCoordinates && " · Map location unavailable"}
    </p>
  );
}
export function Status({ edition }: { edition: PublicOccurrence }) {
  return (
    <p>
      {edition.status === "cancelled"
        ? "Cancelled"
        : edition.status === "postponed"
          ? "Postponed"
          : edition.status === "announced"
            ? "Announced"
            : "Scheduled"}
      {edition.ticketAvailability === "sold_out" && " · Sold out"}
    </p>
  );
}

export function TicketPrice({ edition }: { edition: PublicOccurrence }) {
  let price: string | null = null;
  if (edition.priceKind === "free") {
    price = "Free";
  } else if (edition.priceCurrency && edition.priceMinMinor !== null) {
    const formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency: edition.priceCurrency,
    });
    const minorUnit =
      10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
    const amount = (minor: number) => formatter.format(minor / minorUnit);
    price = `${edition.priceKind === "from" ? "From " : ""}${amount(edition.priceMinMinor)}${edition.priceKind === "range" && edition.priceMaxMinor !== null ? `–${amount(edition.priceMaxMinor)}` : ""}`;
  }
  if (!price) return null;
  return (
    <p>
      Tickets: {price}
      {edition.priceCoverage && edition.priceCoverage !== "full_programme"
        ? ` (${edition.priceCoverage})`
        : ""}
      {edition.priceQualification ? ` · ${edition.priceQualification}` : ""}
    </p>
  );
}
export function EditionItem({ edition }: { edition: PublicOccurrence }) {
  return (
    <li>
      <a href={editionPath(edition.eventSlug, edition.key)}>
        {edition.name ?? `${edition.eventName} ${edition.year}`}
      </a>
      <Dates edition={edition} />
      <Status edition={edition} />
      <Location edition={edition} />
    </li>
  );
}

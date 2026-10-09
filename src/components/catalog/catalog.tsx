import type { PublicOccurrence } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";

export function Dates({ edition }: Readonly<{ edition: PublicOccurrence }>) {
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
export function Location({ edition }: Readonly<{ edition: PublicOccurrence }>) {
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
const statusLabels = {
  cancelled: "Cancelled",
  postponed: "Postponed",
  announced: "Announced",
  scheduled: "Scheduled",
};

export function linkLabel(kind: string): string {
  return kind === "x" ? "X (Twitter)" : kind.replaceAll("_", " ");
}

export function Status({ edition }: Readonly<{ edition: PublicOccurrence }>) {
  return <p>{statusLabels[edition.status]}</p>;
}

const availabilityLabels = {
  available: "Available",
  sold_out: "Sold out",
  closed: "Ticket sales closed",
};

export function TicketCategories({
  edition,
}: Readonly<{ edition: PublicOccurrence }>) {
  if (!edition.ticketCategories.length) {
    return null;
  }
  return (
    <section>
      <h2>Ticket categories</h2>
      <ul>
        {edition.ticketCategories.map((category, index) => (
          <li key={`${category.label}:${index}`}>
            {category.label}
            {category.availability && category.availability !== "unknown" && (
              <> · {availabilityLabels[category.availability]}</>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TicketPrice({
  edition,
}: Readonly<{ edition: PublicOccurrence }>) {
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
    const upperAmount =
      edition.priceKind === "range" && edition.priceMaxMinor !== null
        ? `–${amount(edition.priceMaxMinor)}`
        : "";
    price = `${edition.priceKind === "from" ? "From " : ""}${amount(edition.priceMinMinor)}${upperAmount}`;
  }
  if (!price) {
    return null;
  }
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
export function EditionItem({
  edition,
}: Readonly<{ edition: PublicOccurrence }>) {
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

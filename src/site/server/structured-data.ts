import type { PublicEdition, PublicEvent } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";

const eventStatuses = {
  announced: "EventScheduled",
  scheduled: "EventScheduled",
  cancelled: "EventCancelled",
  postponed: "EventPostponed",
};

export function editionStructuredData(
  event: PublicEvent,
  edition: PublicEdition,
  origin: string,
) {
  const name = edition.name ?? `${event.name} ${edition.year}`;
  if (
    edition.dateState !== "confirmed" ||
    !name.trim() ||
    !edition.countryCode ||
    !(edition.venueAddress?.trim() || edition.locality?.trim())
  ) {
    return null;
  }
  const url = `${origin}${editionPath(event.slug, edition.key)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": url,
    url,
    name,
    ...(event.summary ? { description: event.summary } : {}),
    startDate: edition.startsOn,
    endDate: edition.endsOn,
    eventStatus: `https://schema.org/${eventStatuses[edition.status]}`,
    location: {
      "@type": "Place",
      ...(edition.venueName ? { name: edition.venueName } : {}),
      address: {
        "@type": "PostalAddress",
        addressCountry: edition.countryCode,
        ...(edition.venueAddress
          ? { streetAddress: edition.venueAddress }
          : {}),
        ...(edition.locality ? { addressLocality: edition.locality } : {}),
        ...(edition.administrativeArea
          ? { addressRegion: edition.administrativeArea }
          : {}),
      },
    },
  };
}

export function serializeStructuredData(
  data: NonNullable<ReturnType<typeof editionStructuredData>>,
) {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

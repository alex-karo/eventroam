import type { Metadata } from "next";
import type { PublicEdition, PublicEvent } from "@/catalog/read/contracts";
import { isPastEdition } from "@/catalog/domain/dates";
import {
  dateRange,
  placeName,
  scheduleStatusLabels,
} from "@/components/catalog/format";
import { editionPath, eventPath } from "@/site/site";

export function pageMetadata(
  title: string,
  description: string,
  url: string,
  index = true,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index, follow: true },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary", title, description },
  };
}

export function eventMetadata(event: PublicEvent, origin: string): Metadata {
  return pageMetadata(
    `${event.name} | Eventroam`,
    event.summary ??
      `${event.name}: festival information and published edition history.`,
    `${origin}${eventPath(event.slug)}`,
  );
}

export function editionMetadata(
  event: PublicEvent,
  edition: PublicEdition,
  origin: string,
  now: Date,
): Metadata {
  const name = edition.name ?? event.name;
  const status = [
    scheduleStatusLabels[edition.status],
    isPastEdition(edition, now) ? "Past edition" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const dateLabel = edition.status === "postponed" ? "Previous dates" : "Dates";
  const tentative =
    edition.dateState === "provisional" ? "Tentative dates. " : "";
  const postponement = edition.status === "postponed" ? " New dates TBA." : "";
  return pageMetadata(
    `${event.name} ${edition.year} | ${status} | Eventroam`,
    `${name}, ${edition.year}. ${status}.${postponement} ${tentative}${dateLabel}: ${dateRange(edition.startsOn, edition.endsOn)}. ${placeName(edition)}.`,
    `${origin}${editionPath(event.slug, edition.key)}`,
  );
}

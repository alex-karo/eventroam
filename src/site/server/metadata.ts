import type { Metadata } from "next";
import type { PublicEdition, PublicEvent } from "@/catalog/read/contracts";
import { isPastEdition } from "@/catalog/domain/dates";
import {
  dateRange,
  placeName,
  scheduleStatusLabels,
} from "@/components/catalog/format";
import {
  festivalDescription,
  festivalPreviewDescription,
} from "@/site/festival-description";
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
  const text = festivalPreviewDescription(event) ?? festivalDescription(event);
  const nameLength = event.name.length;
  const startsWithName =
    text.slice(0, nameLength).toLowerCase() === event.name.toLowerCase() &&
    !/^[\p{L}\p{N}]/u.test(text.slice(nameLength));
  return pageMetadata(
    `${event.name} | Eventroam`,
    startsWithName ? text : `${event.name}. ${text}`,
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
  const dates = dateRange(edition.startsOn, edition.endsOn);
  const text = festivalPreviewDescription(event) ?? `${placeName(edition)}.`;
  return pageMetadata(
    `${event.name} ${edition.year} | ${status} | Eventroam`,
    `${name}, ${edition.year}. ${status}.${postponement} ${tentative}${dateLabel}: ${dates}. ${text}`,
    `${origin}${editionPath(event.slug, edition.key)}`,
  );
}

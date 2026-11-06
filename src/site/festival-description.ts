import type { PublicEvent } from "@/catalog/read/contracts";

export function festivalDescription(
  event: Pick<PublicEvent, "name" | "description" | "shortDescription">,
  purpose: "page" | "preview" = "page",
): string {
  const [preferred, fallback] =
    purpose === "page"
      ? [event.description, event.shortDescription]
      : [event.shortDescription, event.description];
  return (
    preferred?.trim() ||
    fallback?.trim() ||
    `${event.name} is a festival listed in the Eventroam catalog.`
  );
}

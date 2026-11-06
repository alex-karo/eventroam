import type { PublicEvent } from "@/catalog/read/contracts";

export function festivalDescription(
  event: Pick<PublicEvent, "name" | "description" | "shortDescription">,
): string {
  return (
    event.description?.trim() ||
    event.shortDescription?.trim() ||
    `${event.name} is a festival listed in the Eventroam catalog.`
  );
}

export function festivalPreviewDescription(
  event: Pick<PublicEvent, "description" | "shortDescription">,
): string | null {
  return event.shortDescription?.trim() || event.description?.trim() || null;
}

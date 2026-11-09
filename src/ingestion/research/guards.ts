import type Database from "better-sqlite3";
import { readResearchCountryBaseline } from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import type { Targets } from "../roles/general/contracts";
import type { ResearchCatalog } from "./context";

type SavedEditions = ResearchCatalog[number]["editions"];

export function editionEligibility(
  targets: Pick<Targets, "previousEdition" | "currentOrNextEdition">,
  saved: SavedEditions | undefined,
  scope: CatalogResearchInput["scope"],
): "continue" | "skipped" | "unchanged" {
  if (
    !targets.previousEdition &&
    !targets.currentOrNextEdition &&
    !saved?.some(
      ({ scheduleStatus }) =>
        scheduleStatus === "scheduled" || scheduleStatus === "announced",
    )
  ) {
    return "skipped";
  }
  if (scope === "current" && !targets.currentOrNextEdition) {
    return "unchanged";
  }
  return "continue";
}

export function countryBaselineConflict(saved: SavedEditions) {
  return (
    new Set(saved.map((e) => e.countryCode?.toUpperCase()).filter(Boolean))
      .size > 1
  );
}

/** Executed inside the writer's outer transaction, before any catalog operation. */
export function assertRefreshBaseline(
  client: Database.Database,
  eventId: string,
  saved: SavedEditions,
) {
  const current = readResearchCountryBaseline(client, eventId);
  const baseline = (
    rows: Pick<SavedEditions[number], "id" | "countryCode">[],
  ) =>
    rows
      .map((e) => `${e.id}:${e.countryCode?.toUpperCase() ?? ""}`)
      .sort((a, b) => a.localeCompare(b));
  if (
    !current ||
    JSON.stringify(baseline(current)) !== JSON.stringify(baseline(saved))
  ) {
    throw new Error("Refresh country baseline changed during research");
  }
}

export function proposedChronology(
  target:
    Pick<NonNullable<Targets["currentOrNextEdition"]>, "fields"> | undefined,
  saved: SavedEditions[number] | undefined,
) {
  const dates = target?.fields.dates;
  const range = dates?.action === "set" ? dates.value : saved;
  const year = target?.fields.year;
  return {
    startsOn: dates?.action === "clear" ? null : (range?.startsOn ?? null),
    endsOn: dates?.action === "clear" ? null : (range?.endsOn ?? null),
    editionYear:
      year?.action === "set" ? year.value : (saved?.editionYear ?? null),
  };
}

export function earlierEdition(
  donor: ReturnType<typeof proposedChronology> | undefined,
  target: ReturnType<typeof proposedChronology>,
) {
  if (!donor) {
    return false;
  }
  return donor.endsOn && target.startsOn
    ? donor.endsOn < target.startsOn
    : donor.editionYear != null &&
        target.editionYear != null &&
        donor.editionYear < target.editionYear;
}

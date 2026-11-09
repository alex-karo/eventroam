import type Database from "better-sqlite3";
import { readResearchCountryBaseline } from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import type { Targets } from "../roles/contracts";
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

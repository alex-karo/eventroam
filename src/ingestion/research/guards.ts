import type Database from "better-sqlite3";
import { readResearchEvent } from "@/catalog/read/research";
import type { ResearchCandidate, ResearchError } from "./contracts";
import type { ResearchCatalog } from "./context";
import type { CatalogResearchInput } from "../contracts";

type Edition = NonNullable<ResearchCandidate["data"]>["editions"][number];
type SavedEditions = ResearchCatalog[number]["editions"];
const invalid = (message: string): ResearchError => ({
  code: "invalid_candidate",
  stage: "validation",
  message,
});

export function countryBaselineConflict(saved: SavedEditions) {
  return (
    new Set(saved.map((e) => e.countryCode?.toUpperCase()).filter(Boolean))
      .size > 1
  );
}

function validateCountries(
  editions: Edition[],
  saved: SavedEditions,
): ResearchError | null {
  if (countryBaselineConflict(saved)) {
    return {
      code: "country_baseline_conflict",
      stage: "validation",
      message: "Saved Edition countries conflict",
    };
  }
  const baseline = saved.find((e) => e.countryCode)?.countryCode?.toUpperCase();
  const conflicting =
    baseline &&
    editions.find((e) => e.countryCode && e.countryCode.value !== baseline);
  if (!conflicting) {
    return null;
  }
  const savedCountries = saved
    .filter((e) => e.countryCode)
    .map((e) => `${e.editionKey}:${e.countryCode?.toUpperCase()}`)
    .join(", ");
  return {
    code: "country_conflict",
    stage: "validation",
    editionKey: conflicting.key,
    field: "countryCode",
    message: `Saved countries ${savedCountries}; observed ${conflicting.key}:${conflicting.countryCode!.value ?? "null"}`,
  };
}
export function validateRefresh(
  candidate: ResearchCandidate,
  saved: SavedEditions,
  scope: CatalogResearchInput["scope"] = "full",
): ResearchError | null {
  if (candidate.status === "failed") {
    return null;
  }
  const editions = candidate.data!.editions;
  if (scope === "current" && editions.length > 1) {
    return invalid("Current refresh may return at most one Edition");
  }
  const savedKeys = new Set(saved.map((e) => e.editionKey));
  const newEditions = editions.filter((e) => !savedKeys.has(e.key));
  if (scope === "full" && newEditions.length > 1) {
    return invalid("Full refresh may return at most one new Edition");
  }
  if (scope === "full" && savedKeys.size + newEditions.length > 20) {
    return {
      code: "limit_reached",
      stage: "validation",
      message: "Full refresh exceeds the 20-Edition boundary",
    };
  }
  return validateCountries(editions, saved);
}
/** Executed inside the writer's outer transaction, before any catalog operation. */
export function assertRefreshBaseline(
  client: Database.Database,
  eventId: string,
  saved: SavedEditions,
) {
  const current = readResearchEvent(client, eventId);
  const baseline = (rows: SavedEditions) =>
    rows
      .map((e) => `${e.id}:${e.countryCode?.toUpperCase() ?? ""}`)
      .sort((a, b) => a.localeCompare(b));
  if (
    !current ||
    JSON.stringify(baseline(current.editions)) !==
      JSON.stringify(baseline(saved))
  ) {
    throw new Error("Refresh country baseline changed during research");
  }
}

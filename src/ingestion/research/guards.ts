import type Database from "better-sqlite3";
import { readResearchCountryBaseline } from "@/catalog/read/research";
import type {
  ResearchCandidate,
  ResearchError,
  ResearchEdition,
} from "./contracts";
import type { ResearchCatalog } from "./context";
import type { CatalogResearchInput } from "../contracts";

type Edition = ResearchEdition;
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
  const data = candidate.data!;
  if (
    scope === "current" &&
    (data.previousEdition ||
      data.summary ||
      data.links.website !== undefined ||
      Object.keys(data.links.socials).length)
  ) {
    return invalid(
      "Current refresh permits only current-or-next Edition findings",
    );
  }
  const editions = [data.previousEdition, data.currentOrNextEdition].filter(
    (edition) => edition !== null,
  );
  return validateCountries(editions, saved);
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

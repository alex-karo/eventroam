import type Database from "better-sqlite3";
import { readResearchEvent } from "@/catalog/read/research";
import type { ResearchCandidate, ResearchError } from "./contracts";
import { countryBaselineConflict, type RefreshContext } from "./scope";

type Edition = NonNullable<ResearchCandidate["data"]>["editions"][number];
const invalid = (message: string): ResearchError => ({
  code: "invalid_candidate",
  stage: "validation",
  message,
});

function validateCountries(
  editions: Edition[],
  context: RefreshContext,
): ResearchError | null {
  if (countryBaselineConflict(context)) {
    return {
      code: "country_baseline_conflict",
      stage: "validation",
      message: "Saved Edition countries conflict",
    };
  }
  const baseline = context.countryBaseline.find(
    (e) => e.countryCode,
  )?.countryCode;
  const conflicting =
    baseline &&
    editions.find((e) => e.countryCode && e.countryCode.value !== baseline);
  if (!conflicting) {
    return null;
  }
  const savedCountries = context.countryBaseline
    .filter((e) => e.countryCode)
    .map((e) => `${e.key}:${e.countryCode}`)
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
  context: RefreshContext,
): ResearchError | null {
  if (candidate.status === "failed") {
    return null;
  }
  const editions = candidate.data!.editions;
  if (context.scope === "current" && editions.length > 1) {
    return invalid("Current refresh may return at most one Edition");
  }
  const savedKeys = new Set(context.savedEditions.map((e) => e.editionKey));
  const newEditions = editions.filter((e) => !savedKeys.has(e.key));
  if (context.scope === "full" && newEditions.length > 1) {
    return invalid("Full refresh may return at most one new Edition");
  }
  if (context.scope === "full" && savedKeys.size + newEditions.length > 20) {
    return {
      code: "limit_reached",
      stage: "validation",
      message: "Full refresh exceeds the 20-Edition boundary",
    };
  }
  return validateCountries(editions, context);
}
/** Executed inside the writer's outer transaction, before any catalog operation. */
export function assertRefreshBaseline(
  client: Database.Database,
  eventId: string,
  context: RefreshContext,
) {
  const current = readResearchEvent(client, eventId);
  const baseline = (rows: RefreshContext["countryBaseline"]) =>
    rows
      .map((e) => `${e.id}:${e.countryCode ?? ""}`)
      .sort((a, b) => a.localeCompare(b));
  const observed =
    current?.editions.map((e) => ({
      id: e.id,
      key: e.editionKey,
      countryCode: e.countryCode?.toUpperCase() ?? null,
    })) ?? [];
  if (
    !current ||
    JSON.stringify(baseline(observed)) !==
      JSON.stringify(baseline(context.countryBaseline))
  ) {
    throw new Error("Refresh country baseline changed during research");
  }
}

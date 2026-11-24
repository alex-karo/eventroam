import type { RegressionPipelineCaseFile } from "../fixtures";
import { refreshInput, sourceReplay } from "./fixture";

type ScopeEdition =
  RegressionPipelineCaseFile["initial"]["event"]["editions"][number];

export function scopeEdition(
  editionKey: string,
  editionYear: number,
  startsOn: string,
  endsOn: string,
  scheduleStatus: ScopeEdition["scheduleStatus"] = "scheduled",
): ScopeEdition {
  return {
    id: `scope-edition-${editionKey}`,
    editionKey,
    editionYear,
    startsOn,
    endsOn,
    dateState: "confirmed",
    scheduleStatus,
    countryCode: "PT",
    venueName: "River Grounds",
    termIds: ["validation:festival", "validation:openair", "validation:music"],
  };
}

export const historyAndAnnouncedEditions = [
  scopeEdition("historic-weekend", 2025, "2025-06-01", "2025-06-03"),
  scopeEdition("announced-weekend", 2026, "2026-10-10", "2026-10-11"),
];

export function scopeFixture(
  id: string,
  task: string,
  scope: "current" | "full",
  editions: ScopeEdition[],
): RegressionPipelineCaseFile {
  const eventId = `scope-event-${id}`;
  const url = `https://scope-fixture.example/${id}`;
  return {
    id,
    suite: "regression",
    origin: "synthetic",
    task,
    provenance: {
      kind: "synthetic-scope-regression",
      note: "Synthetic source facts for model selection/completeness; no live HTTP/search fallback.",
    },
    input: refreshInput(eventId, scope),
    initial: {
      event: {
        id: eventId,
        slug: id,
        canonicalName: "River Festival",
        links: [{ kind: "official_site", url, official: true }],
        editions,
      },
    },
    sources: [sourceReplay(url, "2026-10-03T12:00:00Z", "page.md")],
  };
}

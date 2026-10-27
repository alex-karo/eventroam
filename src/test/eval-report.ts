import type { CatalogResearchResult } from "@/ingestion/contracts";
import {
  DEFAULT_RESEARCH_LIMITS,
  createResearchBudget,
} from "@/ingestion/runtime/budget";

export function evalReport(
  changes: CatalogResearchResult["changes"] = [],
  eventId = "event:test",
): CatalogResearchResult {
  const created = new Map<
    string,
    { eventId?: string; key?: string; year?: number }
  >();
  for (const change of changes) {
    const facts = created.get(change.subject) ?? {};
    if (change.field === "event_id" && typeof change.newValue === "string") {
      facts.eventId = change.newValue;
    }
    if (change.field === "edition_key" && typeof change.newValue === "string") {
      facts.key = change.newValue;
    }
    if (
      change.field === "edition_year" &&
      typeof change.newValue === "number"
    ) {
      facts.year = change.newValue;
    }
    created.set(change.subject, facts);
  }
  const newEditions = [...created].filter(
    ([, facts]) => facts.eventId && facts.key,
  );
  return {
    schemaVersion: 7,
    locationResponse: null,
    locationStatus: "not_run",
    locationPromptVersion: "catalog-location-v1",
    locationModelVersion: "fixture",
    geocoding: { observations: [], points: [] },
    editorResponse: null,
    editorStatus: "not_run",
    editorPromptVersion: "catalog-editor-v6",
    scope: null,
    currentDate: null,
    workload: { savedEditions: 0, returnedEditions: 0 },
    limits: DEFAULT_RESEARCH_LIMITS,
    runId: "eval-fixture-run",
    mode: "refresh",
    outcome: changes.length ? "updated" : "unchanged",
    modelResponse: null,
    researchStatus: "success",
    eventId,
    operations: newEditions.map(([subject, facts]) => ({
      kind: "createEdition",
      eventId: facts.eventId!,
      tempKey: subject,
      data: {
        editionKey: facts.key!,
        ...(facts.year === undefined ? {} : { editionYear: facts.year }),
      },
    })) as CatalogResearchResult["operations"],
    receipts: [],
    references: Object.fromEntries(
      newEditions.map(([subject]) => [subject, subject]),
    ),
    changes,
    sources: [],
    sourceSummaries: [],
    errors: [],
    unresolved: [],
    eventNameMismatch: null,
    budget: {
      ...createResearchBudget().snapshot(),
    },
    modelVersion: "test",
    promptVersion: "test",
    durationMs: 0,
  };
}

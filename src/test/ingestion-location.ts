import { buildLocationInput } from "@/ingestion/location/input";
import type { ResearchData } from "@/ingestion/research/contracts";
import type { ResolvedEditorPlan } from "@/test/ingestion-fixtures/editor-contracts";
import type { Targets } from "@/ingestion/roles/contracts";
import type { FrozenCorpus } from "@/ingestion/evidence/contracts";
/** Express the old test data as explicit source-role inputs. Runtime code does not use this helper. */
export function buildFixtureLocationInput(
  plan: ResolvedEditorPlan,
  data: ResearchData,
  context: Parameters<typeof buildLocationInput>[2],
  input: Parameters<typeof buildLocationInput>[3],
) {
  const evidence = (
    ["previousEdition", "currentOrNextEdition"] as const
  ).flatMap((slot) =>
    Object.entries(data[slot] ?? {}).flatMap(([field, fact]) =>
      fact && typeof fact === "object" && "value" in fact
        ? [
            {
              id: `${slot}-${field}`,
              sourceId: "fixture",
              quote: `${field}: ${JSON.stringify(fact)}`,
              span: { start: 0, end: 1 },
              context: [],
              topics: ["location" as const],
              editionClues: [data[slot]!.key],
              uncertainty: null,
              anchors: [],
            },
          ]
        : [],
    ),
  );
  const corpus: FrozenCorpus = {
    version: "fixture",
    sources: [
      {
        id: "fixture",
        attemptedUrl: "https://example.org/",
        finalUrl: "https://example.org/",
        retrievedAt: context.currentDate,
        status: "ok",
        method: "http",
        processing: "complete",
        limitations: [],
      },
    ],
    evidence,
  };
  const target = (slot: "previousEdition" | "currentOrNextEdition") => {
    const selected = plan[slot];
    if (!selected) {
      return null;
    }
    return {
      editionKey: selected.editionKey,
      reason: selected.reason ?? "Fixture target",
      evidenceIds: evidence.map((item) => item.id),
      fields: Object.fromEntries(
        Object.entries(selected.fields).filter(([key]) =>
          [
            "year",
            "dates",
            "scheduleStatus",
            "displayName",
            "sizeEstimate",
          ].includes(key),
        ),
      ),
    };
  };
  const targets = {
    decision: "targets",
    eventId: data.eventId ?? null,
    observedEventName: data.eventName,
    reason: plan.event?.reason ?? data.reason ?? "Fixture identity",
    evidenceIds: evidence.map((item) => item.id),
    event: {},
    previousEdition: target("previousEdition"),
    currentOrNextEdition: target("currentOrNextEdition"),
    checks: [],
    unresolved: plan.unresolved,
  } as Targets;
  return buildLocationInput(targets, corpus, context, input);
}

import { z } from "zod";
import { scheduleStatuses } from "@/catalog/domain/vocabulary";
import type { CatalogResearchInput } from "../contracts";
import type { ResearchContext } from "../research/context";
import type { Targets } from "../roles/contracts";
import { editionSlotNames } from "../research/contracts";
import type { FrozenCorpus } from "../evidence/contracts";
import { evidencePacket } from "../evidence/contracts";
import { precisionSchema } from "./contracts";
import { previousPoint } from "./geometry";
const placeSchema = z.strictObject({
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  locality: z.string().nullable(),
  administrativeArea: z.string().nullable(),
  countryCode: z.string().nullable(),
});
export const savedLocationSchema = placeSchema.extend({
  id: z.string(),
  eventId: z.string(),
  editionKey: z.string(),
  version: z.number().int().positive(),
  editionYear: z.number().int().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  scheduleStatus: z.enum(scheduleStatuses),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  coordinatePrecision: z.enum(["unknown", ...precisionSchema.options]),
});

const targetSchema = z.strictObject({
  editionKey: z.string(),
  editionYear: z.number().int().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  scheduleStatus: z.enum(scheduleStatuses),
  saved: savedLocationSchema.nullable(),
  previousPoint: savedLocationSchema.nullable(),
});
export const locationInputSchema = z.strictObject({
  festival: z.strictObject({
    name: z.string(),
    summary: z.string().nullable(),
    format: z.array(z.string()),
  }),
  scope: z.enum(["full", "current"]).nullable(),
  currentDate: z.string(),
  countryBaseline: z.string().nullable(),
  sources: z.array(
    z.strictObject({ url: z.string(), information: z.string() }),
  ),
  history: z.array(savedLocationSchema),
  evidence: z.array(z.json()),
  selection: z.json(),
  previousEdition: targetSchema.nullable(),
  currentOrNextEdition: targetSchema.nullable(),
});
export type LocationInput = z.infer<typeof locationInputSchema>;
export type LocationTarget = z.infer<typeof targetSchema>;
export type SavedLocation = z.infer<typeof savedLocationSchema>;
export function buildLocationInput(
  targets: Targets,
  corpus: FrozenCorpus,
  context: ResearchContext,
  input: CatalogResearchInput,
): LocationInput {
  const event = context.catalog.find(
    (event) => event.id === (input.eventId ?? targets.eventId),
  );
  const history =
    event?.editions.map((edition) =>
      savedLocationSchema.strip().parse(edition),
    ) ?? [];
  const packet = evidencePacket(corpus, [
    "location",
    "description",
    "dates",
    "identity",
  ]);
  const result: LocationInput = {
    festival: {
      name: targets.observedEventName,
      summary:
        event?.summary ??
        (targets.event.summary?.action === "set"
          ? targets.event.summary.value
          : null),
      format: [],
    },
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    currentDate: context.currentDate,
    countryBaseline:
      history.find((edition) => edition.countryCode)?.countryCode ?? null,
    sources: corpus.sources
      .filter((source) => source.overview)
      .map((source) => ({
        url: source.finalUrl,
        information: source.overview!,
      })),
    history,
    evidence: JSON.parse(JSON.stringify(packet.evidence)),
    selection: {
      reason: targets.reason,
      evidenceIds: targets.evidenceIds,
      unresolved: targets.unresolved,
      ...Object.fromEntries(
        editionSlotNames.map((slot) => [
          slot,
          targets[slot]
            ? {
                editionKey: targets[slot].editionKey,
                reason: targets[slot].reason,
                evidenceIds: targets[slot].evidenceIds,
              }
            : null,
        ]),
      ),
    },
    previousEdition: null,
    currentOrNextEdition: null,
  };
  for (const slot of editionSlotNames) {
    const selected = targets[slot];
    if (!selected) {
      continue;
    }
    const saved =
      history.find((edition) => edition.editionKey === selected.editionKey) ??
      null;
    const dates = selected.fields.dates,
      year = selected.fields.year,
      status = selected.fields.scheduleStatus;
    const selectedDates = dates?.action === "set" ? dates.value : saved;
    const startsOn =
      dates?.action === "clear" ? null : (selectedDates?.startsOn ?? null);
    const endsOn =
      dates?.action === "clear" ? null : (selectedDates?.endsOn ?? null);
    const target: LocationTarget = {
      editionKey: selected.editionKey,
      editionYear:
        year?.action === "set" ? year.value : (saved?.editionYear ?? null),
      startsOn,
      endsOn,
      scheduleStatus:
        status?.action === "set"
          ? status.value
          : (saved?.scheduleStatus ?? "announced"),
      saved,
      previousPoint: null,
    };
    target.previousPoint = previousPoint(
      {
        ...target,
        id: saved?.id ?? `$${slot}`,
        eventId: event?.id ?? "$event",
        latitude: saved?.latitude ?? null,
        longitude: saved?.longitude ?? null,
      },
      history,
    );
    result[slot] = target;
  }
  return locationInputSchema.parse(result);
}

import { z } from "zod";
import { scheduleStatuses } from "@/catalog/domain/vocabulary";
import type { CatalogResearchInput } from "../contracts";
import type { ResolvedEditorPlan } from "../editor/contracts";
import type { ResearchContext } from "../research/context";
import {
  editionFindingSchema,
  editionSlotNames,
  type ResearchData,
} from "../research/contracts";
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
const findingsSchema = editionFindingSchema.pick({
  venueName: true,
  venueAddress: true,
  locality: true,
  administrativeArea: true,
  countryCode: true,
  coordinates: true,
});
const targetSchema = z.strictObject({
  editionKey: z.string(),
  editionYear: z.number().int().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  scheduleStatus: z.enum(scheduleStatuses),
  saved: savedLocationSchema.nullable(),
  donor: savedLocationSchema.nullable(),
  findings: findingsSchema,
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
  editor: z.strictObject({
    status: z.literal("ready"),
    eventReason: z.string().nullable(),
    previousEdition: z
      .strictObject({ editionKey: z.string(), reason: z.string().nullable() })
      .nullable(),
    currentOrNextEdition: z
      .strictObject({ editionKey: z.string(), reason: z.string().nullable() })
      .nullable(),
  }),
  previousEdition: targetSchema.nullable(),
  currentOrNextEdition: targetSchema.nullable(),
});
export type LocationInput = z.infer<typeof locationInputSchema>;
export type LocationTarget = z.infer<typeof targetSchema>;
export type SavedLocation = z.infer<typeof savedLocationSchema>;
export function buildLocationInput(
  plan: ResolvedEditorPlan,
  research: ResearchData,
  context: ResearchContext,
  input: CatalogResearchInput,
): LocationInput {
  const event = context.catalog.find(
    (item) => item.id === (input.eventId ?? research.eventId),
  );
  const history =
    event?.editions.map((edition) =>
      savedLocationSchema.strip().parse(edition),
    ) ?? [];
  const result: LocationInput = {
    festival: {
      name: research.eventName,
      summary: event?.summary ?? research.summary?.value ?? null,
      format: [
        ...new Set([
          ...(event?.editions.flatMap((edition) =>
            edition.terms
              .filter((term) => term.facet === "format")
              .map((term) => term.slug),
          ) ?? []),
          ...editionSlotNames.flatMap((slot) =>
            (research[slot]?.classification?.value ?? []).flatMap((id) => {
              const term = context.terms.find(
                (item) => item.id === id && item.facet === "format",
              );
              return term ? [term.slug] : [];
            }),
          ),
        ]),
      ],
    },
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    currentDate: context.currentDate,
    countryBaseline:
      history.find((edition) => edition.countryCode)?.countryCode ?? null,
    sources: research.sources,
    history,
    editor: {
      status: "ready",
      eventReason: plan.event?.reason ?? null,
      previousEdition: plan.previousEdition
        ? {
            editionKey: plan.previousEdition.editionKey,
            reason: plan.previousEdition.reason ?? null,
          }
        : null,
      currentOrNextEdition: plan.currentOrNextEdition
        ? {
            editionKey: plan.currentOrNextEdition.editionKey,
            reason: plan.currentOrNextEdition.reason ?? null,
          }
        : null,
    },
    previousEdition: null,
    currentOrNextEdition: null,
  };
  for (const slot of editionSlotNames) {
    const accepted = plan[slot];
    if (!accepted) {
      continue;
    }
    const finding = research[slot]!;
    const saved =
      history.find((edition) => edition.editionKey === accepted.editionKey) ??
      null;
    const dates = accepted.fields.dates;
    const year = accepted.fields.year;
    const status = accepted.fields.scheduleStatus;
    const target = {
      editionKey: accepted.editionKey,
      editionYear:
        year?.action === "set" ? year.value : (saved?.editionYear ?? null),
      startsOn: finalDate(dates, "startsOn", saved),
      endsOn: finalDate(dates, "endsOn", saved),
      scheduleStatus:
        status?.action === "set"
          ? status.value
          : (saved?.scheduleStatus ?? "announced"),
      saved,
      findings: findingsSchema.strip().parse(finding),
      donor: null as SavedLocation | null,
    };
    target.donor = previousPoint(
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

function finalDate(
  action: NonNullable<
    ResolvedEditorPlan["currentOrNextEdition"]
  >["fields"]["dates"],
  field: "startsOn" | "endsOn",
  saved: SavedLocation | null,
) {
  if (action?.action === "set") {
    return action.value[field];
  }
  if (action?.action === "clear") {
    return null;
  }
  return saved?.[field] ?? null;
}

import { isAssignedCountryCode } from "@/catalog/domain/country-codes";
import { z } from "zod";
import { pointSchema } from "../tools/geocode/contracts";
import { editionSlotNames } from "../research/contracts";
import type { GeocodingSession } from "../tools/geocode/tool";
import {
  locationOutputSchema,
  locationTextFields,
  precisionSchema,
  registeredPointSchema,
  locationFieldsSchema,
  type LocationSlot,
  type RegisteredPoint,
} from "./contracts";
import type { LocationInput, LocationTarget } from "./input";

const coordinatesActionSchema = z.union([
  z.strictObject({ action: z.enum(["keep", "clear"]), reason: z.string() }),
  z.strictObject({
    action: z.literal("set"),
    value: pointSchema.extend({ precision: precisionSchema }),
    reason: z.string(),
  }),
]);
type CoordinatesAction = z.infer<typeof coordinatesActionSchema>;
const materializedSlotSchema = locationFieldsSchema.extend({
  coordinates: coordinatesActionSchema,
});
export const materializedLocationSchema = z.strictObject({
  support: z
    .strictObject({
      previousEdition: z.array(z.string()).optional(),
      currentOrNextEdition: z.array(z.string()).optional(),
    })
    .default({}),
  slots: z.strictObject({
    previousEdition: materializedSlotSchema.optional(),
    currentOrNextEdition: materializedSlotSchema.optional(),
  }),
  previousPoints: z.array(registeredPointSchema),
  reusedFrom: z
    .strictObject({
      previousEdition: registeredPointSchema.optional(),
      currentOrNextEdition: registeredPointSchema.optional(),
    })
    .optional(),
  unresolved: z.array(
    z.strictObject({
      message: z.string(),
      editionKey: z.string(),
      field: z.string().optional(),
    }),
  ),
});
export type MaterializedLocation = z.infer<typeof materializedLocationSchema>;
type PointContext = Pick<GeocodingSession, "points" | "targets">;
export class LocationValidationError extends Error {}
export class LocationCountryConflictError extends LocationValidationError {
  constructor(readonly editionKey: string) {
    super("Location country conflicts with saved country");
  }
}
function validateText(
  plan: LocationSlot,
  target: LocationTarget,
  input: LocationInput,
) {
  const action = plan.fields.countryCode;
  let country = target.saved?.countryCode ?? null;
  if (action.action === "set") {
    country = action.value;
  }
  if (action.action === "clear") {
    country = null;
  }
  if (country && !isAssignedCountryCode(country)) {
    throw new LocationValidationError("Invalid Location country");
  }
  if (
    input.countryBaseline &&
    action.action !== "keep" &&
    country !== input.countryBaseline
  ) {
    throw new LocationCountryConflictError(target.editionKey);
  }
  for (const field of locationTextFields) {
    if (plan.fields[field].action === "clear" && !target.saved?.[field]) {
      throw new LocationValidationError("Cannot clear absent location data");
    }
  }
  return country ?? input.countryBaseline;
}
function validateSelection(
  point: RegisteredPoint,
  precision: RegisteredPoint["precision"],
  target: LocationTarget,
  targetId?: string,
) {
  const rank = precisionSchema.options.indexOf(precision);
  const oldRank = precisionSchema.options.indexOf(point.precision);
  if (point.kind === "previousPoint") {
    throw new LocationValidationError(
      "Historical points require reusePrevious",
    );
  }
  if (point.kind === "target" && (point.id !== targetId || rank <= oldRank)) {
    throw new LocationValidationError(
      "Saved target selection can only lower its own precision",
    );
  }
  if (
    point.kind === "source" &&
    (point.editionKey !== target.editionKey || rank < oldRank)
  ) {
    throw new LocationValidationError("Invalid source point or precision");
  }
  if (point.kind !== "candidate") {
    return;
  }
  if (
    (point.objectType === "locality" && precision !== "locality") ||
    (point.objectType === "region" && precision !== "region") ||
    (point.objectType === "unknown" &&
      ["exact", "approximate"].includes(precision))
  ) {
    throw new LocationValidationError("Precision conflicts with point type");
  }
}
function materializePoint(
  plan: LocationSlot,
  target: LocationTarget,
  slot: (typeof editionSlotNames)[number],
  country: string | null,
  session: PointContext,
  previousPoints: RegisteredPoint[],
): CoordinatesAction {
  const coords = plan.coordinates;
  if (coords.action === "keep" || coords.action === "clear") {
    if (coords.action === "clear" && target.saved?.latitude == null) {
      throw new LocationValidationError(
        `${slot}: Cannot clear absent coordinates`,
      );
    }
    return coords;
  }
  const id =
    coords.action === "reusePrevious"
      ? session.targets[slot]?.previousPointId
      : coords.pointId;
  const point = id ? session.points.get(id) : undefined;
  if (!point) {
    throw new LocationValidationError("Unknown Location point");
  }
  if (point.countryCode && country && point.countryCode !== country) {
    throw new LocationValidationError("Point country conflicts with target");
  }
  let precision = point.precision;
  if (coords.action === "reusePrevious") {
    if (
      point.kind !== "previousPoint" ||
      session.targets[slot]?.previousPointId !== id
    ) {
      throw new LocationValidationError("Invalid historical previousPoint");
    }
    previousPoints.push(point);
  } else {
    precision = coords.precision;
    validateSelection(
      point,
      precision,
      target,
      session.targets[slot]?.targetId,
    );
  }
  return {
    action: "set",
    reason: coords.reason,
    value: { latitude: point.latitude, longitude: point.longitude, precision },
  };
}
/** Validate ownership and references. The agent owns factual assessment. */
export function validateLocation(
  raw: unknown,
  input: LocationInput,
  session: PointContext,
): MaterializedLocation {
  const { decision } = locationOutputSchema.parse(raw);
  if (decision.status === "rejected") {
    throw new LocationValidationError("Location rejected the item");
  }
  const result: MaterializedLocation = {
    support: {},
    slots: {},
    previousPoints: [],
    unresolved: [],
  };
  for (const slot of editionSlotNames) {
    const target = input[slot],
      plan = decision[slot];
    if (!target && !plan) {
      continue;
    }
    if (!target || !plan) {
      throw new LocationValidationError(
        "Location target does not match the accepted slot",
      );
    }
    const country = validateText(plan, target, input);
    const ids = new Set(
      input.evidence.flatMap((item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.id === "string"
          ? [item.id]
          : [],
      ),
    );
    if (
      plan.evidenceIds.some((id) => !ids.has(id)) ||
      (locationTextFields.some(
        (field) => plan.fields[field].action !== "keep",
      ) &&
        !plan.evidenceIds.length)
    ) {
      throw new LocationValidationError(
        "Location changes need applicable supplied evidence references",
      );
    }
    result.support[slot] = plan.evidenceIds;
    const coordinates = materializePoint(
      plan,
      target,
      slot,
      country,
      session,
      result.previousPoints,
    );
    result.slots[slot] = { ...plan.fields, coordinates };
    if (plan.coordinates.action === "reusePrevious") {
      result.reusedFrom ??= {};
      result.reusedFrom[slot] = result.previousPoints.at(-1)!;
    }
    result.unresolved.push(
      ...plan.unresolved.map(({ field, message }) => ({
        editionKey: target.editionKey,
        message,
        ...(field ? { field } : {}),
      })),
    );
  }
  return result;
}

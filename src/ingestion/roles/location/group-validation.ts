import { atPath, locationGroupPath, record } from "../../groups";
import { editionSlotNames } from "../../research/contracts";
import type { GeocodingSession } from "../../tools/geocode/tool";
import {
  checkGroups,
  validateProposalBoundary,
  type GroupValidationInput,
  failProposal,
  RepairFailure,
  requireKnownReferences,
} from "../proposal-validation";
import type { LocationInput } from "./input";
import { LocationCountryConflictError, validateLocation } from "./validate";

type Slot = (typeof editionSlotNames)[number];
export type LocationValidationContext = {
  input: LocationInput;
  session: Pick<GeocodingSession, "points" | "targets">;
};
function countryConflict(error: LocationCountryConflictError): never {
  throw new RepairFailure({
    code: "country_conflict",
    stage: "validation",
    editionKey: error.editionKey,
    field: "countryCode",
    message: error.message,
  });
}

function checkLocationBoundary(
  raw: unknown,
  slot: Slot,
  { input, session }: LocationValidationContext,
) {
  const plan = atPath(raw, `decision.${slot}`);
  if (atPath(raw, "decision.status") !== "ready" || !record(plan)) {
    failProposal(
      "Location target does not match the accepted slot",
      undefined,
      "location_failed",
    );
  }
  const action = record(atPath(plan, "fields.countryCode"));
  if (
    input.countryBaseline &&
    action &&
    (action.action === "clear" ||
      (action.action === "set" &&
        typeof action.value === "string" &&
        action.value !== input.countryBaseline))
  ) {
    countryConflict(new LocationCountryConflictError(input[slot]!.editionKey));
  }
  const coords = record(atPath(plan, "coordinates"));
  if (
    coords?.action === "reusePrevious" &&
    !session.targets[slot]?.previousPointId
  ) {
    failProposal("Unknown Location point", undefined, "location_failed");
  }
}

export function materializeLocationReply(
  raw: unknown,
  { input, session }: LocationValidationContext,
  returnedPaths?: ReadonlySet<string>,
  only?: Slot,
) {
  if (only) {
    const other = editionSlotNames.find((slot) => slot !== only)!;
    return validateLocation(
      { decision: { ...record(atPath(raw, "decision")), [other]: null } },
      { ...input, [other]: null },
      session,
      returnedPaths,
    );
  }
  return validateLocation(raw, input, session, returnedPaths);
}

export function validateLocationGroups(options: GroupValidationInput) {
  validateProposalBoundary("location", options);
  const { reply, ctx, returnedPaths, only } = options;
  const location = ctx.location!;
  requireKnownReferences(
    "location",
    reply.raw,
    "pointId",
    [...location.session.points.keys()],
    "Location point",
  );
  if (
    editionSlotNames.some(
      (slot) =>
        !ctx.targets?.[slot] && atPath(reply.raw, `decision.${slot}`) != null,
    )
  ) {
    failProposal(
      "Location proposal for an absent target",
      undefined,
      "location_failed",
    );
  }
  return checkGroups(
    "location",
    options,
    (group) => {
      if (group.owner !== "location") {
        return;
      }
      try {
        materializeLocationReply(
          reply.raw,
          location,
          returnedPaths,
          group.target,
        );
      } catch (error) {
        if (error instanceof LocationCountryConflictError) {
          countryConflict(error);
        }
        return error instanceof Error
          ? error.message
          : "Invalid Location group";
      }
    },
    () => {
      for (const slot of editionSlotNames) {
        if (
          location.input[slot] &&
          (!only || only.has(locationGroupPath(slot)))
        ) {
          checkLocationBoundary(reply.raw, slot, location);
        }
      }
    },
  );
}

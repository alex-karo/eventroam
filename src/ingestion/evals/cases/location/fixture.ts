import type {
  LocationInput,
  LocationTarget,
} from "../../../roles/location/input";

type SavedLocation = NonNullable<LocationTarget["saved"]>;
type EditionSchedule = Omit<LocationTarget, "saved" | "previousPoint">;

export function locationInput(
  target: LocationTarget,
  details: Pick<
    LocationInput,
    "festival" | "countryBaseline" | "sources" | "evidence"
  >,
): LocationInput {
  return {
    ...details,
    scope: "full",
    currentDate: "2026-10-24T12:00:00Z",
    history: [target.saved, target.previousPoint].filter((row) => row !== null),
    previousEdition: null,
    currentOrNextEdition: target,
    selection: {
      eventReason: null,
      previousEdition: null,
      currentOrNextEdition: { editionKey: target.editionKey, reason: null },
      unresolved: [],
    },
  };
}

export function savedTarget(
  saved: SavedLocation,
  previousPoint: SavedLocation | null = null,
): LocationTarget {
  const { editionKey, editionYear, startsOn, endsOn, scheduleStatus } = saved;
  return {
    editionKey,
    editionYear,
    startsOn,
    endsOn,
    scheduleStatus,
    saved,
    previousPoint,
  };
}

export function newTarget(schedule: EditionSchedule): LocationTarget {
  return { ...schedule, saved: null, previousPoint: null };
}

export function locationEvidence(
  editionKey: string,
  suffix: string | number,
  quote: string,
  context: string[] = ["Captured catalog location description"],
  sourceId = "fixture-source",
) {
  return {
    id: `currentOrNextEdition-location-${suffix}`,
    sourceId,
    quote,
    context: context.map((line) => ({ quote: line })),
    topics: ["location"],
    editionClues: [editionKey],
    uncertainty: null,
    anchors: [],
  };
}

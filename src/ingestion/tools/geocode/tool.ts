import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ResearchBudget } from "../../runtime/budget";
import type { RegisteredPoint } from "../../location/contracts";
import type { LocationInput } from "../../location/input";
import { distanceKm } from "../../location/geometry";
import { editionSlotNames } from "../../research/contracts";
import {
  forwardInputSchema,
  geocodingKey,
  type GeocodingObservation,
  type GeocodingRequest,
  type GeocodingResult,
  type GeocodingClient,
} from "./contracts";
import { geocode } from "./geoapify";
export type { GeocodingObservation } from "./contracts";
export function createGeocodingSession(
  input: LocationInput,
  budget: ResearchBudget,
  options: {
    apiKey?: string;
    client?: GeocodingClient;
    abortSignal?: AbortSignal;
    startObservation?: (
      direction: GeocodingRequest["direction"],
      origin: "initial" | "agent",
    ) => ((observation: GeocodingObservation) => void) | undefined;
  } = {},
) {
  const points = new Map<string, RegisteredPoint>();
  const cache = new Map<
    string,
    { result: GeocodingResult; pointIds: string[] }
  >();
  const observations: GeocodingObservation[] = [];
  let calls = 0;
  let nextPointId = 1;
  const signal = AbortSignal.any([
    AbortSignal.timeout(Math.max(1, budget.remaining().durationMs)),
    ...(options.abortSignal ? [options.abortSignal] : []),
  ]);
  const register = (point: Omit<RegisteredPoint, "id">) => {
    const id = `p${nextPointId++}`;
    points.set(id, { ...point, id });
    return id;
  };
  const targets = registerSuppliedPoints(input, register);
  const comparisons = (point: RegisteredPoint) =>
    pointComparisons(point, input, targets, points);
  for (const point of points.values()) {
    if (point.kind === "source") {
      point.comparisons = comparisons(point);
    }
  }
  async function request(
    request: GeocodingRequest,
    origin: "initial" | "agent",
    slots: (typeof editionSlotNames)[number][],
  ) {
    const finishObservation = options.startObservation?.(
      request.direction,
      origin,
    );
    const key = geocodingKey(request);
    const cached = cache.get(key);
    let result: GeocodingResult;
    let pointIds: string[] = [];
    if (signal.aborted || budget.remaining().durationMs <= 0) {
      result = {
        status: "error",
        code:
          signal.reason?.name === "TimeoutError" ||
          budget.remaining().durationMs <= 0
            ? "timeout"
            : "cancelled",
      };
    } else if (calls >= 6) {
      result = { status: "error", code: "limit_reached" };
    } else {
      calls += 1;
      if (cached) {
        result = cached.result;
        pointIds = cached.pointIds;
      } else {
        result = await geocode(request, {
          apiKey: options.apiKey,
          client: options.client,
          signal,
        });
        if (result.status === "success") {
          if (result.direction === "forward") {
            pointIds = result.candidates.map((candidate) => {
              const id = register({
                kind: "candidate",
                latitude: candidate.latitude,
                longitude: candidate.longitude,
                precision: candidatePrecision(candidate.objectType),
                provider: "geoapify",
                ...(candidate.placeId ? { placeId: candidate.placeId } : {}),
                ...(candidate.countryCode
                  ? { countryCode: candidate.countryCode }
                  : {}),
                label: candidate.label,
                objectType: candidate.objectType,
              });
              points.get(id)!.comparisons = comparisons(points.get(id)!);
              return id;
            });
          }
          cache.set(key, { result, pointIds });
        }
      }
    }
    const observation = {
      origin,
      request,
      slots,
      cacheHit: !!cached && result.status === "success",
      result,
      pointIds,
    };
    observations.push(observation);
    finishObservation?.(observation);
    return { ...observation, points: pointIds.map((id) => points.get(id)!) };
  }
  const forward = (query: z.infer<typeof forwardInputSchema>) =>
    request(
      {
        direction: "forward",
        ...query,
        countryCode: input.countryBaseline ?? query.countryCode,
      },
      "agent",
      editionSlotNames.filter((slot) => !!input[slot]),
    );
  const tool = createTool({
    id: "geocode",
    description:
      "Refine an unsuitable prepared location result or try a useful alternate spelling. Search only supplied place context. No saved-point proximity bias. Up to three candidates. Each call counts against the shared six-call limit, including cache hits. A match does not confirm a festival venue.",
    inputSchema: forwardInputSchema,
    outputSchema: z.json(),
    execute: forward,
  });
  return {
    points,
    targets,
    observations,
    request,
    forward,
    tool,
    signal,
    get calls() {
      return calls;
    },
  };
}
export type GeocodingSession = ReturnType<typeof createGeocodingSession>;

function pointComparisons(
  point: RegisteredPoint,
  input: LocationInput,
  targets: GeocodingSession["targets"],
  points: Map<string, RegisteredPoint>,
) {
  return editionSlotNames
    .filter((slot) => input[slot])
    .map((slot) => {
      const ids = targets[slot];
      const target = ids?.targetId ? points.get(ids.targetId) : undefined;
      const donor = ids?.donorId ? points.get(ids.donorId) : undefined;
      return {
        slot,
        targetKm: target ? distanceKm(point, target) : null,
        donorKm: donor ? distanceKm(point, donor) : null,
      };
    });
}

function candidatePrecision(type: string): RegisteredPoint["precision"] {
  if (type === "locality" || type === "region") {
    return type;
  }
  return "approximate";
}

function registerSuppliedPoints(
  input: LocationInput,
  register: (point: Omit<RegisteredPoint, "id">) => string,
) {
  const targets: Partial<
    Record<
      (typeof editionSlotNames)[number],
      { targetId?: string; donorId?: string; sourceId?: string }
    >
  > = {};
  const savedIds = new Map<string, string>();
  for (const slot of editionSlotNames) {
    const target = input[slot];
    if (!target) {
      continue;
    }
    const ids: { targetId?: string; donorId?: string; sourceId?: string } = {};
    for (const [kind, saved] of [
      ["target", target.saved],
      ["donor", target.donor],
    ] as const) {
      if (
        saved?.latitude == null ||
        saved.longitude == null ||
        saved.coordinatePrecision === "unknown"
      ) {
        continue;
      }
      const key = `${kind}:${saved.id}`;
      let id = savedIds.get(key);
      if (!id) {
        id = register({
          kind,
          editionId: saved.id,
          editionKey: saved.editionKey,
          version: saved.version,
          latitude: saved.latitude,
          longitude: saved.longitude,
          precision: saved.coordinatePrecision,
          ...(saved.countryCode ? { countryCode: saved.countryCode } : {}),
        });
        savedIds.set(key, id);
      }
      if (kind === "target") {
        ids.targetId = id;
      } else {
        ids.donorId = id;
      }
    }
    ids.sourceId = registerSourcePoint(target, register);
    targets[slot] = ids;
  }
  return targets;
}

function registerSourcePoint(
  target: NonNullable<LocationInput["currentOrNextEdition"]>,
  register: (point: Omit<RegisteredPoint, "id">) => string,
) {
  const source = target.findings.coordinates?.value;
  if (source) {
    return register({
      kind: "source",
      editionKey: target.editionKey,
      latitude: source.latitude,
      longitude: source.longitude,
      precision: source.precision,
      ...(target.findings.countryCode?.value
        ? { countryCode: target.findings.countryCode.value }
        : {}),
    });
  }
}

import { expect, test, vi } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { createGeocodingSession } from "../tools/geocode/tool";
import type {
  GeocodingRequest,
  GeocodingResult,
  GeocodingClient,
} from "../tools/geocode/contracts";
import { distanceKm } from "./geometry";
import {
  locationOutputSchema,
  locationModelOutputSchema,
  locationTextFields,
} from "./contracts";
import { locationInputSchema, type LocationInput } from "./input";
import { prepareInitialGeocoding } from "./initial";
import { validateLocation } from "./validate";
import { resolveLocation } from "./agent";
function input(): LocationInput {
  return locationInputSchema.parse({
    festival: { name: "Festival", summary: null, format: ["open_air"] },
    scope: "full",
    currentDate: "2026-10-25T12:00:00Z",
    countryBaseline: "PT",
    sources: [
      {
        url: "https://festival.test/venue",
        information: "The park is the venue.",
      },
    ],
    history: [],
    evidence: [
      {
        id: "e1",
        quote: "Central Park, Lisbon, Portugal, 2027",
        context: [],
        topics: ["location"],
        editionClues: ["2027"],
        anchors: [],
      },
    ],
    selection: {
      eventReason: null,
      unresolved: [],
      previousEdition: null,
      currentOrNextEdition: { editionKey: "2027", reason: "New Edition" },
    },
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      editionYear: 2027,
      startsOn: "2027-06-01",
      endsOn: "2027-06-03",
      scheduleStatus: "scheduled",
      saved: null,
      previousPoint: null,
    },
  });
}
function output() {
  return {
    decision: {
      status: "ready",
      previousEdition: null,
      currentOrNextEdition: {
        fields: Object.fromEntries(
          locationTextFields.map((key) => [
            key,
            { action: "keep", reason: "Preserve" },
          ]),
        ),
        coordinates: { action: "keep", reason: "Preserve" },
        evidenceIds: ["e1"],
        unresolved: [],
      },
    },
  };
}
const forward = {
  status: "success",
  direction: "forward",
  candidates: [
    {
      latitude: 38.72,
      longitude: -9.14,
      placeId: null,
      label: "Lisbon",
      name: null,
      countryCode: "PT",
      locality: "Lisbon",
      address: null,
      objectType: "locality",
      originalType: "city",
      category: null,
      confidence: null,
    },
  ],
} satisfies GeocodingResult;
function response(request: GeocodingRequest): GeocodingResult {
  return request.direction === "forward"
    ? forward
    : {
        status: "success",
        direction: "reverse",
        queriedPoint: {
          latitude: request.latitude,
          longitude: request.longitude,
        },
        nearby: forward.candidates[0],
        distanceKm: distanceKm(request, forward.candidates[0]),
      };
}

function pointInput(): LocationInput {
  const data = input();
  data.currentOrNextEdition!.saved = {
    id: "saved",
    eventId: "event",
    editionKey: "2027",
    version: 2,
    editionYear: 2027,
    startsOn: null,
    endsOn: null,
    scheduleStatus: "announced",
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "exact",
    venueName: "Old Park",
    venueAddress: null,
    locality: "Lisbon",
    administrativeArea: null,
    countryCode: "PT",
  };
  return data;
}
test("strict decisions reject numeric coordinates and removed reference fields", () => {
  expect(locationModelOutputSchema()).toMatchObject({
    type: "object",
    required: ["decision"],
  });
  expect(locationOutputSchema.safeParse(output()).success).toBe(true);
  expect(
    locationOutputSchema.safeParse({
      decision: { status: "rejected", reason: "Wrong festival" },
    }).success,
  ).toBe(true);
  for (const patch of [
    { fields: {} },
    { coordinates: { action: "set", latitude: 1, longitude: 2 } },
    { pointRefs: [] },
  ]) {
    const raw = output();
    Object.assign(raw.decision.currentOrNextEdition, patch);
    expect(locationOutputSchema.safeParse(raw).success).toBe(false);
  }
});
test("initial context uses reverse only and equal slot pairs share it", async () => {
  const data = pointInput();
  data.previousEdition = structuredClone(data.currentOrNextEdition);
  data.previousEdition!.editionKey = "2026";
  const client = vi.fn(async (request: GeocodingRequest) => response(request));
  const session = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, session);
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.observations[0].request.direction).toBe("reverse");
  expect(session.observations[0].slots).toHaveLength(2);
  expect(
    [...session.points.values()].every((point) => point.kind !== "candidate"),
  ).toBe(true);
});
test("forward queries belong to the agent and share its six-call allowance", async () => {
  const client = vi.fn(async () => forward);
  const session = createGeocodingSession(input(), createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(input(), session);
  expect(client).not.toHaveBeenCalled();
  for (let i = 0; i < 7; i++) {
    await session.forward({ query: "Central Park, Lisbon", countryCode: "ES" });
  }
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.calls).toBe(6);
  expect(session.observations[1].cacheHit).toBe(true);
  expect(session.observations.at(-1)?.result).toEqual({
    status: "error",
    code: "limit_reached",
  });
  expect(session.observations[0].request).toMatchObject({ countryCode: "PT" });
});
test("short point IDs are local and candidate precision follows its object", async () => {
  const first = createGeocodingSession(input(), createResearchBudget(), {
    client: async () => forward,
  });
  const second = createGeocodingSession(input(), createResearchBudget(), {
    client: async () => ({
      ...forward,
      candidates: [{ ...forward.candidates[0], latitude: 38.8 }],
    }),
  });
  await Promise.all([
    first.forward({ query: "Lisbon", countryCode: "PT" }),
    second.forward({ query: "Lisbon", countryCode: "PT" }),
  ]);
  expect(first.points.get("p1")?.latitude).toBe(38.72);
  expect(second.points.get("p1")?.latitude).toBe(38.8);
  const raw = output();
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    action: "select",
    pointId: "p1",
    precision: "exact",
  });
  expect(() => validateLocation(raw, input(), first)).toThrow("Precision");
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    precision: "locality",
  });
  expect(
    validateLocation(raw, input(), first).slots.currentOrNextEdition
      ?.coordinates,
  ).toMatchObject({ action: "set", value: { precision: "locality" } });
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    pointId: "unknown",
  });
  expect(() => validateLocation(raw, input(), first)).toThrow("Unknown");
});
test("saved precision can only decrease for its own target", () => {
  const data = pointInput(),
    session = createGeocodingSession(data, createResearchBudget()),
    raw = output();
  const pointId = session.targets.currentOrNextEdition!.targetId;
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    action: "select",
    pointId,
    precision: "locality",
  });
  expect(
    validateLocation(raw, data, session).slots.currentOrNextEdition
      ?.coordinates,
  ).toMatchObject({ value: { precision: "locality" } });
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    precision: "exact",
  });
  expect(() => validateLocation(raw, data, session)).toThrow("lower");
  session.targets.currentOrNextEdition = {};
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    precision: "locality",
  });
  expect(() => validateLocation(raw, data, session)).toThrow("own");
});
test("reusePrevious binds the earlier record without a model point ID", async () => {
  const data = input();
  data.currentOrNextEdition!.previousPoint = {
    ...pointInput().currentOrNextEdition!.saved!,
    editionKey: "2026",
    editionYear: 2026,
    coordinatePrecision: "locality",
    version: 4,
  };
  const session = createGeocodingSession(data, createResearchBudget(), {
    client: async (request) => response(request),
  });
  await prepareInitialGeocoding(data, session);
  expect(
    [...session.points.values()].some((point) => point.kind === "candidate"),
  ).toBe(false);
  const raw = output();
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    action: "reusePrevious",
  });
  const materialized = validateLocation(raw, data, session);
  expect(materialized.previousPoints[0].version).toBe(4);
  expect(materialized.slots.currentOrNextEdition?.coordinates).toMatchObject({
    action: "set",
    value: { precision: "locality" },
  });
  expect(() =>
    validateLocation(
      raw,
      input(),
      createGeocodingSession(input(), createResearchBudget()),
    ),
  ).toThrow("Unknown");
});
test("keep never reuses a point and clear requires a saved target", () => {
  const data = input();
  data.currentOrNextEdition!.previousPoint =
    pointInput().currentOrNextEdition!.saved;
  const session = createGeocodingSession(data, createResearchBudget());
  expect(validateLocation(output(), data, session).previousPoints).toEqual([]);
  const raw = output();
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    action: "clear",
  });
  expect(() => validateLocation(raw, data, session)).toThrow(
    "Cannot clear absent",
  );
});
test("literal source points retain evidence support and malformed pairs are absent", () => {
  const data = input();
  data.evidence = [
    {
      id: "e1",
      quote: "Festival map 2027. Latitude: 38.7; Longitude: -9.1",
      context: [],
    },
  ];
  const session = createGeocodingSession(data, createResearchBudget());
  expect(session.targets.currentOrNextEdition!.sourceId).toBe("p1");
  expect(session.points.get("p1")).toMatchObject({
    kind: "source",
    evidenceIds: ["e1"],
    editionKey: "2027",
  });
});
test("successful empty responses are cached and cancellation stops requests", async () => {
  const abort = new AbortController();
  const client = vi.fn<GeocodingClient>(async () => ({
    status: "success",
    direction: "forward",
    candidates: [],
  }));
  const session = createGeocodingSession(input(), createResearchBudget(), {
    client,
    abortSignal: abort.signal,
  });
  await session.forward({ query: "Park", countryCode: "PT" });
  await session.forward({ query: "Park", countryCode: "PT" });
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.observations[1].cacheHit).toBe(true);
  abort.abort();
  await session.forward({ query: "Other", countryCode: "PT" });
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.observations.at(-1)?.result).toEqual({
    status: "error",
    code: "cancelled",
  });
});
test("changed place text requires supplied evidence IDs and the same slot", () => {
  const data = input(),
    session = createGeocodingSession(data, createResearchBudget()),
    raw = output();
  Object.assign(raw.decision.currentOrNextEdition.fields.locality, {
    action: "set",
    value: "Lisbon",
  });
  raw.decision.currentOrNextEdition.evidenceIds = [];
  expect(() => validateLocation(raw, data, session)).toThrow("references");
  raw.decision.currentOrNextEdition.evidenceIds = ["wrong"];
  expect(() => validateLocation(raw, data, session)).toThrow("references");
  raw.decision.currentOrNextEdition.evidenceIds = ["e1"];
  expect(
    validateLocation(raw, data, session).support.currentOrNextEdition,
  ).toEqual(["e1"]);
  raw.decision.previousEdition = raw.decision.currentOrNextEdition as never;
  expect(() => validateLocation(raw, data, session)).toThrow("target");
});
test("schema failures retain issue paths while technical errors omit raw messages", async () => {
  const config = {
    apiKey: "fixture",
    model: "fixture",
    limits: createResearchBudget().limits,
  };
  const raw = output();
  raw.decision.currentOrNextEdition.coordinates.reason = "";
  const invalid = await resolveLocation(
    pointInput(),
    createResearchBudget(),
    config,
    {
      generateLocation: async () => raw,
      geocodingClient: async () => ({ status: "error", code: "unavailable" }),
    },
  );
  expect(invalid.errors[0].message).toBe(
    "decision.currentOrNextEdition.coordinates.reason:too_small",
  );
  const failed = await resolveLocation(
    pointInput(),
    createResearchBudget(),
    config,
    {
      generateLocation: async () => {
        throw new Error("https://provider.test/?apiKey=secret");
      },
      geocodingClient: async () => ({ status: "error", code: "unavailable" }),
    },
  );
  expect(failed.errors[0].message).toBe(
    "Location execution or validation failed (type=error)",
  );
  expect(JSON.stringify(failed)).not.toContain("secret");
});

test("Location reports safe nested provider diagnostics without transport data", async () => {
  const result = await resolveLocation(
    pointInput(),
    createResearchBudget(),
    {
      apiKey: "fixture",
      model: "fixture",
      limits: createResearchBudget().limits,
    },
    {
      generateLocation: async () => {
        throw Object.assign(new Error("secret outer message"), {
          name: "MastraError",
          cause: Object.assign(new Error("secret provider response"), {
            name: "AI_APICallError",
            statusCode: 503,
            url: "https://provider.test/?apiKey=secret",
            data: {
              error: {
                message: "secret body",
                metadata: { error_type: "provider_unavailable", key: "secret" },
              },
            },
          }),
        });
      },
      geocodingClient: async () => ({ status: "error", code: "unavailable" }),
    },
  );
  expect(result.errors).toEqual([
    {
      code: "location_failed",
      stage: "location",
      message:
        "Location execution or validation failed (type=api_call; httpStatus=503; providerCode=provider_unavailable)",
    },
  ]);
  expect(JSON.stringify(result)).not.toContain("secret");
});

test("injected Location shares cancellation and retains initial errors", async () => {
  const controller = new AbortController();
  const result = await resolveLocation(
    pointInput(),
    createResearchBudget(),
    {
      apiKey: "fixture",
      model: "fixture",
      limits: createResearchBudget().limits,
    },
    {
      generateLocation: async (_prompt, context) => {
        controller.abort();
        context.abortSignal.throwIfAborted();
        return output();
      },
      geocodingClient: async () => ({
        status: "error",
        code: "provider_error",
      }),
    },
    undefined,
    controller.signal,
  );
  expect(result.status).toBe("failed");
  expect(result.observations[0].result).toEqual({
    status: "error",
    code: "provider_error",
  });
});

test("active initial cancellation stops the transport before model generation", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const generateLocation = vi.fn(async () => output());
  const execution = resolveLocation(
    pointInput(),
    createResearchBudget(),
    {
      apiKey: "fixture",
      model: "fixture",
      limits: createResearchBudget().limits,
    },
    {
      generateLocation,
      geocodingClient: (_request, signal) => {
        started();
        return new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    },
    undefined,
    controller.signal,
  );
  await ready;
  controller.abort();
  const result = await execution;
  expect(result.status).toBe("failed");
  expect(result.observations[0].result).toEqual({
    status: "error",
    code: "cancelled",
  });
  expect(generateLocation).not.toHaveBeenCalled();
});

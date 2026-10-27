import { expect, test, vi } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { loadResearchConfig } from "../runtime/config";
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
    editor: {
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
      donor: null,
      findings: {
        venueName: { value: "Central Park", reason: "Official venue" },
        locality: { value: "Lisbon", reason: "Official city" },
        countryCode: { value: "PT", reason: "Official country" },
      },
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
test("strict object root retains a nested decision union and rejects missing actions or numeric coordinates", () => {
  expect(locationModelOutputSchema()).toMatchObject({
    type: "object",
    required: ["decision"],
  });
  expect(
    locationOutputSchema.parse({
      decision: { status: "rejected", reason: "Wrong festival" },
    }).decision.status,
  ).toBe("rejected");
  const raw = output();
  expect(locationOutputSchema.safeParse(raw).success).toBe(true);
  for (const patch of [
    { fields: {} },
    { coordinates: { action: "set", latitude: 1, longitude: 2 } },
    { extra: true },
  ]) {
    expect(
      locationOutputSchema.safeParse({
        decision: {
          ...raw.decision,
          currentOrNextEdition: {
            ...raw.decision.currentOrNextEdition,
            ...patch,
          },
        },
      }).success,
    ).toBe(false);
  }
});
test("initial requests deduplicate across slots and agent cache hits count", async () => {
  const data = input();
  data.previousEdition = structuredClone(data.currentOrNextEdition);
  data.previousEdition!.editionKey = "2026";
  const client = vi.fn(async (request: GeocodingRequest) => response(request));
  const session = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, session);
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.observations[0].slots).toHaveLength(2);
  const request = session.observations[0].request;
  if (request.direction !== "forward") {
    throw new Error("Expected forward request");
  }
  for (let i = 0; i < 6; i++) {
    await session.forward({ query: request.query, countryCode: "ES" });
  }
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.calls).toBe(6);
  expect(session.observations[1]).toMatchObject({
    origin: "agent",
    request: { ...request, countryCode: "PT" },
    slots: ["previousEdition", "currentOrNextEdition"],
    cacheHit: true,
  });
  expect(session.observations.at(-1)?.result).toEqual({
    status: "error",
    code: "limit_reached",
  });
});
test("new venue never appends an old address and withdrawn text stays absent", async () => {
  const data = input();
  data.currentOrNextEdition!.saved = {
    id: "e",
    eventId: "f",
    editionKey: "2027",
    version: 1,
    editionYear: 2027,
    startsOn: null,
    endsOn: null,
    scheduleStatus: "announced",
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "exact",
    venueName: "Old",
    venueAddress: "Old address",
    locality: "Old city",
    administrativeArea: null,
    countryCode: "PT",
  };
  const client = vi.fn(async (request: GeocodingRequest) => response(request));
  const session = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, session);
  expect(session.observations).toHaveLength(2);
  expect(JSON.stringify(session.observations.at(-1)?.request)).not.toContain(
    "Old",
  );
  expect(
    [...session.points.values()].filter((point) => point.kind === "candidate"),
  ).toHaveLength(1);
  data.currentOrNextEdition!.findings = {
    venueName: { value: null, reason: "Withdrawn" },
  };
  const other = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, other);
  expect(other.observations).toHaveLength(1);
});
test("source selection, accepted slots, city precision and unknown IDs are checked", async () => {
  const data = input();
  data.currentOrNextEdition!.findings.coordinates = {
    value: { latitude: 38.7, longitude: -9.1, precision: "exact" },
    reason: "Official map",
  };
  const session = createGeocodingSession(data, createResearchBudget(), {
    client: async (request) => response(request),
  });
  const raw = output();
  const slot = raw.decision.currentOrNextEdition;
  Object.assign(slot.coordinates, {
    action: "select",
    pointId: session.targets.currentOrNextEdition!.sourceId,
    precision: "exact",
  });
  expect(
    validateLocation(raw, data, session).slots.currentOrNextEdition?.coordinates
      .action,
  ).toBe("set");
  Object.assign(slot.coordinates, { pointId: "another-assignment" });
  expect(() => validateLocation(raw, data, session)).toThrow("Unknown");
  await prepareInitialGeocoding(data, session);
  const city = [...session.points.values()].find(
    (point) => point.kind === "candidate",
  )!;
  Object.assign(slot.coordinates, { pointId: city.id, precision: "exact" });
  expect(() => validateLocation(raw, data, session)).toThrow("Precision");
  Object.assign(slot.coordinates, { precision: "locality" });
  expect(
    validateLocation(raw, data, session).slots.currentOrNextEdition
      ?.coordinates,
  ).toMatchObject({ action: "set", value: { precision: "locality" } });
  expect(() =>
    validateLocation(
      { decision: { ...raw.decision, currentOrNextEdition: null } },
      data,
      session,
    ),
  ).toThrow("target");
});
test("missing credentials remain bounded context and model fallback uses the configured model", async () => {
  const data = input();
  const config = loadResearchConfig({
    NODE_ENV: "test",
    OPENROUTER_API_KEY: "test",
    OPENROUTER_MODEL: "test/model",
  });
  expect(config.locationModel).toBe("test/model");
  const execution = await resolveLocation(
    data,
    createResearchBudget(),
    config,
    { generateLocation: async () => output() },
  );
  expect(execution.status).toBe("success");
  expect(execution.observations[0].result).toEqual({
    status: "error",
    code: "unavailable",
  });
  expect(execution.points).toEqual([]);
});
test("saved precision can only decrease for its own target", () => {
  const data = input();
  const session = createGeocodingSession(data, createResearchBudget());
  const raw = output();
  session.points.set("old", {
    id: "old",
    kind: "target",
    editionKey: "2027",
    latitude: 1,
    longitude: 2,
    precision: "exact",
  });
  session.targets.currentOrNextEdition = { targetId: "old" };
  Object.assign(raw.decision.currentOrNextEdition.coordinates, {
    action: "select",
    pointId: "old",
    precision: "locality",
  });
  expect(
    validateLocation(raw, data, session).slots.currentOrNextEdition
      ?.coordinates,
  ).toMatchObject({
    value: { latitude: 1, longitude: 2, precision: "locality" },
  });
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

test("distinct slots use four initial requests and failures are not cached", async () => {
  const data = input();
  const saved = {
    id: "target",
    eventId: "f",
    editionKey: "2027",
    version: 1,
    editionYear: 2027,
    startsOn: null,
    endsOn: null,
    scheduleStatus: "scheduled" as const,
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate" as const,
    venueName: "Old park",
    venueAddress: "Old road",
    locality: "Lisbon",
    administrativeArea: null,
    countryCode: "PT",
  };
  data.currentOrNextEdition!.saved = saved;
  data.previousEdition = structuredClone(data.currentOrNextEdition);
  data.previousEdition!.editionKey = "2026";
  data.previousEdition!.saved = {
    ...saved,
    id: "previous",
    editionKey: "2026",
    latitude: 39,
  };
  data.previousEdition!.findings.venueName!.value = "Other Park";
  const client = vi.fn<GeocodingClient>(async () => ({
    status: "error",
    code: "rate_limited",
  }));
  const session = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, session);
  expect(session.calls).toBe(4);
  await session.request(session.observations[0].request, "agent", [
    "previousEdition",
  ]);
  expect(client).toHaveBeenCalledTimes(5);
  expect(
    session.observations.every((observation) => !observation.cacheHit),
  ).toBe(true);
  // Country-only findings retain the saved place description.
  data.previousEdition = null;
  data.currentOrNextEdition!.findings = {
    countryCode: { value: "PT", reason: "Confirmed country" },
  };
  const other = createGeocodingSession(data, createResearchBudget(), {
    client,
  });
  await prepareInitialGeocoding(data, other);
  expect(other.observations[1].request).toMatchObject({
    query: "Old park, Old road, Lisbon, PT",
  });
});

test("successful empty responses are cached, cancellation stops both request origins", async () => {
  const data = input();
  const abort = new AbortController();
  const client = vi.fn<GeocodingClient>(async () => ({
    status: "success",
    direction: "forward",
    candidates: [],
  }));
  const session = createGeocodingSession(data, createResearchBudget(), {
    client,
    abortSignal: abort.signal,
  });
  await prepareInitialGeocoding(data, session);
  const query = session.observations[0].request;
  await session.request(query, "agent", ["currentOrNextEdition"]);
  expect(client).toHaveBeenCalledTimes(1);
  expect(session.observations[1]).toMatchObject({
    cacheHit: true,
    result: { status: "success", candidates: [] },
  });
  abort.abort();
  await session.request(query, "initial", ["currentOrNextEdition"]);
  await session.request(query, "agent", ["currentOrNextEdition"]);
  expect(client).toHaveBeenCalledTimes(1);
  expect(
    session.observations
      .slice(-2)
      .every(
        (observation) =>
          observation.result.status === "error" &&
          observation.result.code === "cancelled",
      ),
  ).toBe(true);
});

test("donor inheritance preserves precision and reverse results cannot become points", async () => {
  const data = input();
  data.currentOrNextEdition!.donor = {
    id: "donor",
    eventId: "f",
    editionKey: "2026",
    version: 4,
    editionYear: 2026,
    startsOn: null,
    endsOn: null,
    scheduleStatus: "scheduled",
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "locality",
    venueName: null,
    venueAddress: null,
    locality: "Lisbon",
    administrativeArea: null,
    countryCode: "PT",
  };
  const session = createGeocodingSession(data, createResearchBudget(), {
    client: async (request) => response(request),
  });
  await prepareInitialGeocoding(data, session);
  expect(
    [...session.points.values()].filter((point) => point.kind === "candidate"),
  ).toHaveLength(1);
  const raw = output();
  raw.decision.currentOrNextEdition.coordinates = {
    action: "inherit",
    donorPointId: session.targets.currentOrNextEdition!.donorId,
    reason: "Same venue",
  } as never;
  const materialized = validateLocation(raw, data, session);
  expect(materialized.slots.currentOrNextEdition?.coordinates).toMatchObject({
    action: "set",
    value: { latitude: 38.7, longitude: -9.1, precision: "locality" },
  });
  expect(materialized.donors[0].version).toBe(4);
  raw.decision.currentOrNextEdition.unresolved = [
    { field: "coordinates", message: "Inherited without fresh verification" },
  ] as never;
  expect(validateLocation(raw, data, session).unresolved).toEqual([
    {
      editionKey: data.currentOrNextEdition!.editionKey,
      field: "coordinates",
      message: "Inherited without fresh verification",
    },
  ]);
  raw.decision.previousEdition = {
    ...raw.decision.currentOrNextEdition,
  } as never;
  expect(() => validateLocation(raw, data, session)).toThrow("target");
});

test("a rejected donor stays absent through keep and clear reports the invalid slot", async () => {
  const data = input();
  const donor = {
    id: "previous",
    eventId: "f",
    editionKey: "2026",
    version: 1,
    editionYear: 2026,
    startsOn: null,
    endsOn: null,
    scheduleStatus: "scheduled" as const,
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate" as const,
    venueName: "Central Park",
    venueAddress: null,
    locality: "Lisbon",
    administrativeArea: null,
    countryCode: "PT",
  };
  data.currentOrNextEdition!.donor = donor;
  data.previousEdition = {
    ...structuredClone(data.currentOrNextEdition!),
    editionKey: "2026",
    saved: donor,
    donor: null,
  };
  const raw = output();
  const previous = structuredClone(raw.decision.currentOrNextEdition);
  previous.coordinates = {
    action: "clear",
    reason: "Saved point is disproved",
  };
  raw.decision.previousEdition = previous as never;
  const next = raw.decision.currentOrNextEdition;
  next.coordinates = { action: "clear", reason: "Donor is disproved" };
  next.unresolved = [
    { field: "coordinates", message: "No supported replacement" },
  ] as never;
  const run = () =>
    resolveLocation(
      data,
      createResearchBudget(),
      {
        apiKey: "fixture",
        model: "fixture",
        limits: createResearchBudget().limits,
      },
      {
        generateLocation: async () => raw,
        geocodingClient: async () => ({ status: "error", code: "unavailable" }),
      },
    );
  const invalid = await run();
  expect(invalid.status).toBe("failed");
  expect(invalid.materialized).toBeNull();
  expect(invalid.modelResponse?.object).toEqual(raw);
  expect(invalid.errors).toEqual([
    {
      code: "location_failed",
      stage: "location",
      message: "currentOrNextEdition: Cannot clear absent coordinates",
    },
  ]);
  next.coordinates = {
    action: "keep",
    reason: "Do not inherit disproved donor",
  };
  const valid = await run();
  expect(valid.status).toBe("success");
  expect(valid.materialized?.slots.previousEdition?.coordinates.action).toBe(
    "clear",
  );
  expect(
    valid.materialized?.slots.currentOrNextEdition?.coordinates.action,
  ).toBe("keep");
  expect(valid.materialized?.donors).toEqual([]);
  expect(valid.materialized?.unresolved).toEqual([
    {
      editionKey: "2027",
      field: "coordinates",
      message: "No supported replacement",
    },
  ]);
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
    input(),
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
    input(),
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
    input(),
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
    input(),
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
    input(),
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

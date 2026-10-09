import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../runtime/budget";
import {
  classifyModelError,
  modelContext,
  normalizeWireCandidate,
  promptFor,
} from "./agent";
import { savedTickets } from "./saved-tickets";
import { ResearchLimitError } from "../runtime/budget";
import { researchCandidateSchema } from "./contracts";

const raw = () => ({
  status: "success",
  errors: [],
  unresolved: [],
  data: {
    eventId: null,
    eventName: "Example Fest",
    reason: null,
    sources: [],
    summary: null,
    links: { website: null, socials: { x: null } },
    editions: [
      {
        key: "2027",
        year: null,
        dates: {
          value: null,
          reason: "Official cancellation removes announced dates",
        },
        venueName: { value: null, reason: "Old venue explicitly withdrawn" },
        tickets: {
          value: { variants: [], basePrice: null },
          reason: "Official page withdrew sales",
        },
        links: { tickets: null },
      },
    ],
  },
});

test("nested model errors retain only bounded diagnostic metadata", () => {
  const secret = "PRIVATE_PROVIDER_TOKEN";
  const cause = Object.assign(new TypeError(secret), {
    code: "ECONNRESET",
    isRetryable: true,
    cause: Object.assign(new Error(secret), { code: 429 }),
  });
  const error = Object.assign(new Error(secret), {
    name: secret,
    statusCode: 503,
    code: secret,
    headers: { authorization: secret },
    cause,
  });
  const classified = classifyModelError(error, Date.now() + 60_000);
  expect(classified).toEqual({
    limit: undefined,
    diagnostic: {
      errorTypes: ["UnknownError", "TypeError", "Error"],
      httpStatus: 503,
      providerCode: "ECONNRESET",
      retryable: true,
    },
  });
  expect(JSON.stringify(classified)).not.toContain(secret);
  expect(
    classifyModelError(
      Object.assign(new Error(), { data: { error: { code: 429 } } }),
      Date.now() + 60_000,
    ).diagnostic.providerCode,
  ).toBe(429);
});

test("nested research limit takes precedence over model diagnostics", () => {
  const classified = classifyModelError(
    Object.assign(new Error("provider wrapper"), {
      statusCode: 503,
      cause: new ResearchLimitError("modelCalls"),
    }),
    Date.now() + 60_000,
  );
  expect(classified.limit?.limit).toBe("modelCalls");
});

test("wire normalization omits only declared optional null slots and preserves intentional clearing", () => {
  const value = normalizeWireCandidate(raw());
  expect(value).toMatchObject({
    data: {
      editions: [
        {
          dates: { value: null },
          venueName: { value: null },
          tickets: { value: { basePrice: null } },
        },
      ],
    },
  });
  expect(researchCandidateSchema.safeParse(value).success).toBe(true);
  expect(
    researchCandidateSchema.safeParse(
      normalizeWireCandidate({
        status: "failed",
        data: null,
        errors: [{ code: "limit_reached", message: "Exhausted" }],
        unresolved: [],
      }),
    ).success,
  ).toBe(true);
});

test("required nulls and unknown legacy fields survive normalization for strict rejection", () => {
  for (const mutation of [
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data, { claims: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.editions[0], { timeZone: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.editions[0].dates, {
        value: { startsOn: "2027-06-01", endsOn: null, state: "confirmed" },
      });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.editions[0].tickets, { value: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data, { sources: null });
    },
  ]) {
    const item = raw();
    mutation(item);
    expect(
      researchCandidateSchema.safeParse(normalizeWireCandidate(item)).success,
    ).toBe(false);
  }
});

test("saved prices reconstruct in major units but main context omits money", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.occurrence(event, {
    occurrenceKey: "2027",
    priceKind: "exact",
    priceCurrency: "KWD",
    priceMinMinor: 1234,
    priceMaxMinor: 1234,
    priceCoverage: "full_programme",
    priceDetails: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
  });
  const catalog = readResearchCatalog(client);
  const context = modelContext(catalog[0]);
  expect(savedTickets(catalog[0].editions[0])).toEqual({
    variants: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
    basePrice: {
      kind: "exact",
      currency: "KWD",
      minAmount: 1.234,
      maxAmount: 1.234,
      coverage: "full_programme",
    },
  });
  expect(context.editions[0]).not.toHaveProperty("tickets");
  expect(context.editions[0]).not.toHaveProperty("priceMinMinor");
  expect(context.editions[0]).not.toHaveProperty("ticketAvailability");
  const prompt = JSON.parse(
    promptFor(
      { mode: "check", eventId: event.id, actor: "tester" },
      catalog,
      [],
      [],
      createResearchBudget().remaining(),
      [],
      "2026-10-08",
    ),
  ) as { compact: unknown };
  expect(prompt.compact).not.toBeNull();
});

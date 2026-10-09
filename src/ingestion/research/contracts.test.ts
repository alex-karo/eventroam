import { expect, test } from "vitest";
import { researchCandidateSchema, type ResearchCandidate } from "./contracts";
import { majorToMinor, minorToMajor } from "./money";

const candidate = (): ResearchCandidate => ({
  status: "success",
  errors: [],
  unresolved: [],
  data: {
    eventName: "Example Fest",
    reason: "Official organizer identifies the festival",
    sources: [],
    links: { socials: {} },
    editions: [{ key: "2027", links: {} }],
  },
});
const valid = (value: unknown) =>
  researchCandidateSchema.safeParse(value).success;

test("envelope keeps research completion separate from diagnostics", () => {
  const success = candidate();
  expect(valid(success)).toBe(true);
  success.unresolved = [{ message: "Unannounced next year" }];
  success.errors = [
    {
      code: "source_unavailable",
      message: "A source failed",
      url: "https://old.example/",
    },
  ];
  expect(valid(success)).toBe(true);
  expect(
    valid({
      status: "partial",
      data: success.data,
      errors: [],
      unresolved: [],
    }),
  ).toBe(false);
  expect(
    valid({
      status: "partial",
      data: success.data,
      errors: [],
      unresolved: [{ message: "Ticket page inaccessible", editionKey: "2027" }],
    }),
  ).toBe(true);
  expect(
    valid({
      status: "failed",
      data: null,
      errors: [{ code: "source_blocked", message: "Blocked" }],
      unresolved: [],
    }),
  ).toBe(true);
  expect(
    valid({ status: "failed", data: success.data, errors: [], unresolved: [] }),
  ).toBe(false);
  expect(
    valid({ status: "failed", data: null, errors: [], unresolved: [] }),
  ).toBe(false);
  expect(
    valid({ status: "success", data: null, errors: [], unresolved: [] }),
  ).toBe(false);
});

test("strict named facts require reasons and complete groups", () => {
  const value = candidate();
  value.data!.editions[0] = {
    key: "2027",
    links: {},
    dates: {
      value: {
        startsOn: "2027-06-10",
        endsOn: "2027-06-12",
        state: "confirmed",
      },
      reason: "Official schedule",
    },
    coordinates: {
      value: { latitude: 10, longitude: 20, precision: "exact" },
      reason: "Venue map",
    },
    venueAddress: { value: null, reason: "Old address was withdrawn" },
    scheduleStatus: { value: "cancelled", reason: "Official cancellation" },
    classification: {
      add: { value: ["music"], reason: "Programme is music" },
      remove: { value: ["old"], reason: "Old classification obsolete" },
    },
  };
  expect(valid(value)).toBe(true);
  expect(valid({ ...value, claims: [] })).toBe(false);
  for (const patch of [
    { status: "completed" },
    { timeZone: "Europe/Lisbon" },
    { ticketAvailability: "sold_out" },
    {
      dates: {
        value: { startsOn: "2027-06-10", state: "confirmed" },
        reason: "Incomplete",
      },
    },
    {
      coordinates: {
        value: { latitude: 10, longitude: null, precision: "exact" },
        reason: "Incomplete",
      },
    },
    { year: { value: 2027, reason: "" } },
    { prices: [] },
  ]) {
    expect(
      valid({
        ...value,
        data: {
          ...value.data,
          editions: [{ ...value.data!.editions[0], ...patch }],
        },
      }),
    ).toBe(false);
  }
  expect(
    valid({
      ...value,
      data: {
        ...value.data,
        editions: [value.data!.editions[0], value.data!.editions[0]],
      },
    }),
  ).toBe(false);
});

test("ticket blocks and social slots reject legacy and malformed proposals", () => {
  const value = candidate();
  value.data!.links = {
    website: "https://festival.example/",
    socials: {
      x: "https://twitter.com/festival",
      other: "https://mastodon.social/@festival",
    },
  };
  value.data!.editions[0].tickets = {
    value: {
      variants: [
        { label: "Early Bird", availability: "sold_out" },
        {
          label: "Regular",
          amount: 100.5,
          currency: "EUR",
          availability: "available",
        },
      ],
      basePrice: {
        kind: "from",
        currency: "EUR",
        minAmount: 100.5,
        maxAmount: 100.5,
        coverage: "full_programme",
      },
    },
    reason: "Official ticket categories",
  };
  expect(valid(value)).toBe(true);
  expect(
    valid({
      ...value,
      data: {
        ...value.data,
        links: { socials: { x: "https://x.com/festival" } },
      },
    }),
  ).toBe(true);
  for (const links of [
    { socials: { twitter: "https://twitter.com/festival" } },
    { socials: [] },
    { socials: { instagram: ["https://instagram.com/festival"] } },
    { socials: { x: "https://other.example/" } },
    { website: "ftp://festival.example/", socials: {} },
  ]) {
    expect(valid({ ...value, data: { ...value.data, links } })).toBe(false);
  }
  for (const block of [
    null,
    { variants: [] },
    { variants: [], basePrice: null, priceDetails: [] },
    { variants: [{ label: "Regular", amount: 10 }], basePrice: null },
    {
      variants: [{ label: "Regular", amount: 10, currency: "eur" }],
      basePrice: null,
    },
    {
      variants: [{ label: "Regular", amount: 1.001, currency: "EUR" }],
      basePrice: null,
    },
  ]) {
    expect(
      valid({
        ...value,
        data: {
          ...value.data,
          editions: [
            {
              ...value.data!.editions[0],
              tickets: { value: block, reason: "Official ticket page" },
            },
          ],
        },
      }),
    ).toBe(false);
  }
});

test("source URLs are unique after normalization and require useful summary", () => {
  const value = candidate();
  value.data!.sources = [
    {
      url: "https://EXAMPLE.org:443/#dates",
      information: "2027 programme dates",
    },
  ];
  expect(valid(value)).toBe(true);
  expect(
    valid({
      ...value,
      data: {
        ...value.data,
        sources: [
          ...value.data!.sources,
          { url: "https://example.org/", information: "More" },
        ],
      },
    }),
  ).toBe(false);
  expect(
    valid({
      ...value,
      data: {
        ...value.data,
        sources: [{ url: "https://example.org/", information: "" }],
      },
    }),
  ).toBe(false);
});

test("malformed source and X URLs return validation issues without throwing", () => {
  for (const malformedUrl of ["not-a-url", "https://%", "https://[::1"]) {
    const invalidSource = candidate();
    invalidSource.data!.sources = [
      { url: malformedUrl, information: "A source summary" },
    ];
    const sourceResult = researchCandidateSchema.safeParse(invalidSource);
    expect(sourceResult.success).toBe(false);
    if (!sourceResult.success) {
      expect(sourceResult.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["data", "sources", 0, "url"] }),
        ]),
      );
    }

    const invalidX = candidate();
    invalidX.data!.links.socials.x = malformedUrl;
    const xResult = researchCandidateSchema.safeParse(invalidX);
    expect(xResult.success).toBe(false);
    if (!xResult.success) {
      expect(xResult.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["data", "links", "socials", "x"] }),
        ]),
      );
    }
  }
});

test("money uses currency exponents and rejects excess precision or unsafe units", () => {
  expect(majorToMinor(100.5, "EUR")).toBe(10050);
  expect(majorToMinor(1000, "JPY")).toBe(1000);
  expect(majorToMinor(1.234, "KWD")).toBe(1234);
  expect(minorToMajor(1234, "KWD")).toBe(1.234);
  expect(() => majorToMinor(1.001, "EUR")).toThrow();
  expect(() => majorToMinor(1.1, "JPY")).toThrow();
  expect(() => majorToMinor(Number.MAX_SAFE_INTEGER, "EUR")).toThrow();
  expect(() => majorToMinor(1, "ZZZ")).toThrow();
  const value = candidate();
  value.data!.editions[0].tickets = {
    value: {
      variants: [],
      basePrice: {
        kind: "range",
        currency: "EUR",
        minAmount: 10,
        maxAmount: 20,
        coverage: "full_programme",
      },
    },
    reason: "Official full programme price",
  };
  expect(valid(value)).toBe(true);
  const invalidPrices = [
    {
      kind: "range",
      currency: "EUR",
      minAmount: 20,
      maxAmount: 10,
      coverage: "full_programme",
    },
    {
      kind: "exact",
      currency: "EUR",
      minAmount: 10,
      maxAmount: 20,
      coverage: "full_programme",
    },
    {
      kind: "exact",
      currency: "EUR",
      minMinor: 1000,
      maxMinor: 1000,
      coverage: "full_programme",
    },
    {
      kind: "free",
      currency: "EUR",
      minAmount: 0,
      maxAmount: 0,
      coverage: "full_programme",
    },
  ];
  for (const basePrice of invalidPrices) {
    expect(
      valid({
        ...value,
        data: {
          ...value.data,
          editions: [
            {
              ...value.data!.editions[0],
              tickets: {
                value: { variants: [], basePrice },
                reason: "Official",
              },
            },
          ],
        },
      }),
    ).toBe(false);
  }
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { PublicEdition } from "@/catalog/read/contracts";
import {
  Status,
  TicketCategories,
  TicketPrice,
  linkLabel,
} from "@/components/catalog/catalog";

const edition: PublicEdition = {
  id: "edition",
  eventId: "event",
  key: "2027",
  eventSlug: "test-event",
  eventName: "Test Event",
  name: null,
  year: 2027,
  startsOn: "2027-07-01",
  endsOn: "2027-07-03",
  dateState: "confirmed",
  status: "scheduled",
  ticketCategories: [],
  venueName: null,
  venueAddress: null,
  locality: "Test Valley",
  administrativeArea: null,
  countryCode: "PT",
  latitude: null,
  longitude: null,
  coordinatePrecision: "unknown",
  timeZone: null,
  sizeEstimate: null,
  priceKind: null,
  priceCurrency: null,
  priceMinMinor: null,
  priceMaxMinor: null,
  priceCoverage: null,
  priceQualification: null,
  terms: [],
  links: [],
};

const render = (fields: Partial<PublicEdition>) =>
  renderToStaticMarkup(
    createElement(TicketPrice, {
      edition: { ...edition, ...fields },
    }),
  );

test("category amounts use major units and preserve separate availability", () => {
  const categories = renderToStaticMarkup(
    createElement(TicketCategories, {
      edition: {
        ...edition,
        ticketCategories: [
          {
            label: "Early Bird",
            amount: 69.9,
            currency: "EUR",
            terms: "Plus fees",
            availability: "sold_out",
          },
          { label: "Regular", availability: "available" },
          { label: "Child", amount: 0 },
          { label: "Late", availability: "closed" },
        ],
      },
      now: new Date("2026-10-01"),
    }),
  );
  expect(categories).toContain("€69.90");
  expect(categories).toContain("Plus fees");
  expect(categories).toContain("Sold out");
  expect(categories).toContain("Available");
  expect(categories).toContain("Free");
  expect(categories).toContain("Price not available");
  expect(categories).not.toContain("href");
  expect(render({})).toBe("");
  expect(linkLabel("x")).toBe("X (Twitter)");
});
test("base prices scale minor units and retain their own qualifiers", () => {
  expect(
    render({ priceKind: "exact", priceCurrency: "JPY", priceMinMinor: 12000 }),
  ).toContain("¥12,000");
  expect(
    render({
      priceKind: "from",
      priceCurrency: "EUR",
      priceMinMinor: 6990,
      priceQualification: "Plus fees",
    }),
  ).toContain(
    'From €69.90</strong><small class="price-qualification">Plus fees',
  );
  expect(
    render({
      priceKind: "range",
      priceCurrency: "KWD",
      priceMinMinor: 12345,
      priceMaxMinor: 23456,
    }),
  ).toContain("KWD 12.345–KWD 23.456");
  expect(
    render({
      priceKind: "free",
      priceCoverage: "day",
      priceQualification: "Registration required",
    }),
  ).toContain(
    'Free</strong> (day)<small class="price-qualification">Registration required',
  );
});
test("past prices suppress Available but keep closed categories and schedule notices", () => {
  const past = {
    ...edition,
    status: "cancelled" as const,
    ticketCategories: [
      { label: "Regular", availability: "available" as const },
      { label: "Early", availability: "sold_out" as const },
      { label: "Late", availability: "closed" as const },
    ],
  };
  const now = new Date("2028-01-01");
  const categories = renderToStaticMarkup(
    createElement(TicketCategories, { edition: past, now }),
  );
  expect(categories).not.toContain(">Available<");
  expect(categories).toContain("Sold out");
  expect(categories).toContain("Ticket sales closed");
  expect(
    renderToStaticMarkup(createElement(Status, { edition: past, now })),
  ).toContain("Cancelled · Past edition");
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { PublicOccurrence } from "@/catalog/read/contracts";
import {
  Status,
  TicketCategories,
  TicketPrice,
  linkLabel,
} from "@/components/catalog/catalog";

const edition: PublicOccurrence = {
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
  hasCoordinates: false,
  capacityEstimate: null,
  priceKind: null,
  priceCurrency: null,
  priceMinMinor: null,
  priceMaxMinor: null,
  priceCoverage: null,
  priceQualification: null,
  terms: [],
  links: [],
};

const render = (fields: Partial<PublicOccurrence>) =>
  renderToStaticMarkup(
    createElement(TicketPrice, {
      edition: { ...edition, ...fields },
    }),
  );

test("ticket statuses appear only beside named categories", () => {
  const output = renderToStaticMarkup(
    createElement(Status, {
      edition: {
        ...edition,
        ticketCategories: [
          { label: "Early Bird", availability: "sold_out" },
          { label: "Regular", availability: "available" },
          { label: "Last Chance", availability: "closed" },
          { label: "Unknown", availability: "unknown" },
          { label: "Unset" },
        ],
      },
    }),
  );
  expect(output).toBe("<p>Scheduled</p>");
  const categories = renderToStaticMarkup(
    createElement(TicketCategories, {
      edition: {
        ...edition,
        ticketCategories: [
          { label: "Early Bird", availability: "sold_out" },
          { label: "Regular", availability: "available" },
          { label: "Last Chance", availability: "closed" },
          { label: "Unknown", availability: "unknown" },
          { label: "Unset" },
        ],
      },
    }),
  );
  expect(categories).toContain("Early Bird · Sold out");
  expect(categories).toContain("Regular · Available");
  expect(categories).toContain("Last Chance · Ticket sales closed");
  expect(categories).toContain("<li>Unknown</li><li>Unset</li>");
  expect(
    renderToStaticMarkup(
      createElement(TicketCategories, {
        edition,
      }),
    ),
  ).toBe("");
  expect(linkLabel("x")).toBe("X (Twitter)");
});

test("Occurrence ticket output scales original-currency minor units", () => {
  const exact = {
    priceKind: "exact" as const,
    priceCurrency: "EUR",
    priceMinMinor: 12000,
  };
  expect(render(exact)).toBe("<p>Tickets: €120.00</p>");
  expect(render({ ...exact, priceCurrency: "JPY" })).toBe(
    "<p>Tickets: ¥12,000</p>",
  );
  expect(render({ ...exact, priceCurrency: "KWD", priceMinMinor: 12345 })).toBe(
    "<p>Tickets: KWD 12.345</p>",
  );
});

test("Occurrence ticket output preserves from, range, free, coverage and qualification", () => {
  expect(
    render({
      priceKind: "from",
      priceCurrency: "JPY",
      priceMinMinor: 12000,
    }),
  ).toBe("<p>Tickets: From ¥12,000</p>");
  expect(
    render({
      priceKind: "range",
      priceCurrency: "KWD",
      priceMinMinor: 12345,
      priceMaxMinor: 23456,
    }),
  ).toBe("<p>Tickets: KWD 12.345–KWD 23.456</p>");
  expect(
    render({
      priceKind: "free",
      priceCurrency: null,
      priceMinMinor: 0,
      priceMaxMinor: 0,
      priceCoverage: "day",
      priceQualification: "Registration required",
    }),
  ).toBe("<p>Tickets: Free (day) · Registration required</p>");
  expect(render({})).toBe("");
});

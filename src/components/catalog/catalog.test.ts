import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { PublicOccurrence } from "@/catalog/read/contracts";
import { TicketPrice } from "@/components/catalog/catalog";

const render = (fields: Partial<PublicOccurrence>) =>
  renderToStaticMarkup(
    createElement(TicketPrice, {
      edition: {
        priceKind: null,
        priceCurrency: null,
        priceMinMinor: null,
        priceMaxMinor: null,
        priceCoverage: null,
        priceQualification: null,
        ...fields,
      } as PublicOccurrence,
    }),
  );

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

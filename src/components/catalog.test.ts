import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { PublicOccurrence } from "../application/public-catalog";
import { TicketPrice } from "./catalog";

const base = {
  priceKind: "exact",
  priceCurrency: "EUR",
  priceMinMinor: 12000,
  priceMaxMinor: 12000,
  priceCoverage: "full_programme",
  priceQualification: null,
} as PublicOccurrence;
const render = (fields: Partial<PublicOccurrence>) =>
  renderToStaticMarkup(
    createElement(TicketPrice, { edition: { ...base, ...fields } }),
  );

test("Occurrence ticket output scales original-currency minor units", () => {
  expect(render({})).toBe("<p>Tickets: €120.00</p>");
  expect(render({ priceCurrency: "JPY" })).toBe("<p>Tickets: ¥12,000</p>");
  expect(render({ priceCurrency: "KWD", priceMinMinor: 12345 })).toBe(
    "<p>Tickets: KWD 12.345</p>",
  );
});

test("Occurrence ticket output preserves from, range, free, coverage and qualification", () => {
  expect(render({ priceKind: "from", priceCurrency: "JPY" })).toBe(
    "<p>Tickets: From ¥12,000</p>",
  );
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
  expect(
    render({ priceKind: null, priceCurrency: null, priceMinMinor: null }),
  ).toBe("");
});

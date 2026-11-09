import { expect, test } from "vitest";
import { linkFact } from "./facts";

function ticketLink(url: string) {
  return { kind: "ticketing", official: true, url };
}

test.each([
  ["https://example.com/", "https://example.com"],
  ["https://example.com/tickets", "https://example.com/tickets/"],
  [
    "https://EXAMPLE.com:443/tickets/?year=2026#book",
    "https://example.com/tickets?year=2026#book",
  ],
])("accepts %s as %s", (actual, expected) => {
  expect(
    linkFact("tickets", [ticketLink(actual)], "ticketing", [expected]).status,
  ).toBe("correct");
});

test.each([
  ["https://example.com/tickets//", "https://example.com/tickets/"],
  ["https://example.com/signup/", "https://example.com/tickets"],
  ["https://example.com/tickets?ref=/", "https://example.com/tickets?ref="],
  ["https://example.com/tickets#book/", "https://example.com/tickets#book"],
])("keeps %s distinct from %s", (actual, expected) => {
  expect(
    linkFact("tickets", [ticketLink(actual)], "ticketing", [expected]).status,
  ).toBe("wrong");
});

test("rejects duplicate official links with different trailing slashes", () => {
  const url = "https://example.com/tickets";
  expect(
    linkFact("tickets", [ticketLink(url), ticketLink(`${url}/`)], "ticketing", [
      url,
    ]).status,
  ).toBe("wrong");
});

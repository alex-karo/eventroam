import { expect, test, vi } from "vitest";
import { isPastEdition, localToday } from "./dates";

test("past status uses the local end day", () => {
  const now = new Date("2027-07-04T00:30:00Z");
  expect(
    isPastEdition(
      { endsOn: "2027-07-03", timeZone: "America/Los_Angeles" },
      now,
    ),
  ).toBe(false);
  expect(
    isPastEdition({ endsOn: "2027-07-03", timeZone: "Europe/Lisbon" }, now),
  ).toBe(true);
  expect(isPastEdition({ endsOn: "2027-07-04", timeZone: null }, now)).toBe(
    false,
  );
});

test("an invalid time zone falls back to the UTC day", () => {
  vi.stubEnv("TZ", "America/Los_Angeles");
  const now = new Date("2027-07-04T00:30:00Z");

  expect(now.getDate()).toBe(3);
  expect(localToday("invalid", now)).toBe("2027-07-04");
});

import { expect, test } from "vitest";
import { isPastEdition, localToday } from "./dates";

test("past status uses the local end day and UTC fallback", () => {
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
  expect(localToday("invalid", now)).toBe("2027-07-04");
});

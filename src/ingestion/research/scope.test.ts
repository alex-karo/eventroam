import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import {
  createRefreshContext,
  countryBaselineConflict,
  fieldRegistry,
} from "./scope";

test.each(["full", "current"] as const)(
  "%s context retains complete saved inputs without certifying selection",
  (scope) => {
    const client = testDatabase().client;
    const fx = testFixtures(client);
    const event = fx.event();
    fx.edition(event, {
      editionKey: "source-row",
      editionYear: 2026,
      startsOn: "2026-10-10",
      endsOn: "2026-10-11",
      timeZone: "America/Los_Angeles",
      countryCode: "IE",
    });
    fx.edition(event, {
      editionKey: "far-future",
      editionYear: 2028,
      countryCode: null,
    });
    const saved = readResearchEvent(client, event.id)!.editions;
    const context = createRefreshContext(scope, saved, "2026-10-12T05:00:00Z");
    expect(context.savedEditions).toEqual(saved);
    expect(context.fieldRegistry).toEqual(fieldRegistry);
    expect(context.countryBaseline).toEqual(
      saved.map((e) => ({
        id: e.id,
        key: e.editionKey,
        countryCode: e.countryCode,
      })),
    );
    expect(context.rules.join(" ")).toContain("local final day");
    expect(context.rules.join(" ")).toContain("Year alone is not identity");
    expect(context).not.toHaveProperty("selection");
    expect(context).not.toHaveProperty("resolution");
    expect(context).not.toHaveProperty("assignment");
    expect(countryBaselineConflict(context)).toBe(false);
  },
);
test("country baseline conflict ignores unknown countries and detects distinct known siblings", () => {
  const context = createRefreshContext("full", [], "2026-10-11T12:00:00Z");
  context.countryBaseline = [
    { id: "one", key: "one", countryCode: "IE" },
    { id: "two", key: "two", countryCode: null },
  ];
  expect(countryBaselineConflict(context)).toBe(false);
  context.countryBaseline.push({
    id: "three",
    key: "three",
    countryCode: "AU",
  });
  expect(countryBaselineConflict(context)).toBe(true);
});

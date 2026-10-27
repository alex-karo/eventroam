import { expect, test } from "vitest";
import { geocodingKey } from "../tools/geocode/contracts";
import { loadEvalSuite } from "./fixtures";
import { fixedGeocoding } from "./run";

test.each([
  ["wacken", "Wacken, Schleswig-Holstein, Germany", "DE", "Wacken"],
  ["wacken", "Wacken, Germany", "DE", "Wacken"],
  [
    "sziget",
    "Óbuda Island, Május 9. park, Budapest, Hungary, 1033, Budapest, HU",
    "HU",
    "Budapest",
  ],
  ["sziget", "Budapest, Hungary", "HU", "Budapest"],
  ["sziget", "Budapest, Budapest, Hungary", "HU", "Budapest"],
  ["roskilde", "Festivalpladsen, Darupvej 19, Roskilde", "DK", "Roskilde"],
])(
  "%s replays an observed geocoding request: %s",
  async (id, query, countryCode, locality) => {
    const item = loadEvalSuite().cases.find((item) => item.id === id)!;
    const result = await fixedGeocoding(item)(
      { direction: "forward", query, countryCode },
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      status: "success",
      candidates: [{ locality, countryCode, objectType: "locality" }],
    });
  },
);

test("main geocoding uses declared source-backed locality results with exact requests", async () => {
  for (const item of loadEvalSuite().cases.filter((c) => c.suite === "main")) {
    const fixtures = item.geocoding ?? [];
    expect(new Set(fixtures.map((f) => geocodingKey(f.request))).size).toBe(
      fixtures.length,
    );
    for (const fixture of fixtures) {
      expect(fixture.provenance).toContain("geonames.org");
      expect(fixture.response.status).toBe("success");
      expect(
        await fixedGeocoding(item)(
          fixture.request,
          new AbortController().signal,
        ),
      ).toEqual(fixture.response);
    }
    expect(
      await fixedGeocoding(item)(
        {
          direction: "forward",
          query: "uncaptured spelling",
          countryCode: "DE",
        },
        new AbortController().signal,
      ),
    ).toEqual({ status: "error", code: "fixture_miss" });
  }
});

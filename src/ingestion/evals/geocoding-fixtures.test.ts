import { expect, test } from "vitest";
import { geocodingKey } from "../tools/geocode/contracts";
import { loadEvalSuite } from "./fixtures";
import { fixedGeocoding } from "./run";

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

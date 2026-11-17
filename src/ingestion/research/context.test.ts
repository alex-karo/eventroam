import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import * as reads from "@/catalog/read/research";
import { loadResearchContext } from "./context";

afterEach(() => vi.restoreAllMocks());

test.each(["country", "url"] as const)(
  "%s-supported match returns a small context without full catalog reads",
  (support) => {
    const client = testDatabase().client;
    const fx = testFixtures(client);
    const event = fx.event({ canonicalName: "Example Fest" });
    fx.edition(event, { countryCode: support === "country" ? "US" : null });
    if (support === "url") {
      fx.eventLink(event, { url: "https://example.com/", official: true });
    }
    const catalog = vi.spyOn(reads, "readResearchCatalog");
    const fullEvent = vi.spyOn(reads, "readResearchEvent");
    const terms = vi.spyOn(reads, "readResearchTerms");
    const links = vi.spyOn(reads, "readResearchOfficialLinks");
    const context = loadResearchContext(
      client,
      {
        mode: "add",
        actor: "test",
        input:
          support === "country"
            ? "Example Fest, us"
            : "Example Fest https://example.com/",
      },
      "2028-02-03T12:00:00.000Z",
    );
    expect(context).toEqual({
      catalog: [],
      terms: [],
      knownLinks: [],
      currentDate: "2028-02-03T12:00:00.000Z",
      inputDuplicate: {
        eventId: event.id,
        matchedName: "Example Fest",
        support:
          support === "country"
            ? { countryCode: "US" }
            : { officialUrl: "https://example.com/" },
      },
    });
    expect(catalog).not.toHaveBeenCalled();
    expect(fullEvent).not.toHaveBeenCalled();
    expect(terms).not.toHaveBeenCalled();
    if (support === "country") {
      expect(links).not.toHaveBeenCalled();
    }
  },
);

test("an unresolved add loads no saved Events, and refresh loads only its target", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.edition(event, { countryCode: "US" });
  fx.eventLink(event, { url: "https://example.com/", official: true });
  fx.edition(fx.event({ canonicalName: "Unrelated Festival" }));
  const names = vi.spyOn(reads, "readResearchNames");
  const fullEvent = vi.spyOn(reads, "readResearchEvent");
  const add = loadResearchContext(client, {
    mode: "add",
    input: "Example Fest",
    actor: "test",
  });
  expect(add).not.toHaveProperty("inputDuplicate");
  expect(add.catalog).toEqual([]);
  expect(fullEvent).not.toHaveBeenCalled();
  expect(add.terms.length).toBeGreaterThan(0);
  expect(add.knownLinks).toEqual([]);
  names.mockClear();
  const refresh = loadResearchContext(client, {
    mode: "refresh",
    eventId: event.id,
    actor: "test",
  });
  expect(names).not.toHaveBeenCalled();
  expect(refresh).not.toHaveProperty("inputDuplicate");
  expect(refresh.catalog).toHaveLength(1);
  expect(refresh.catalog[0]).toMatchObject({
    id: event.id,
    editions: [expect.objectContaining({ id: edition.id })],
  });
  expect(refresh.knownLinks).toContainEqual({
    url: "https://example.com/",
    owner: "event",
    kind: "official_site",
    official: true,
  });
});

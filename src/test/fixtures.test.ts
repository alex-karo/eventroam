import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";

test("builders preserve explicit null and do not insert data", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.build.event({ summary: null, canonicalName: undefined });
  const undated = fx.build.edition(event, { startsOn: null });

  expect(event.canonicalName).toBe("Test Field Days");
  expect(event.summary).toBeNull();
  expect(undated).toMatchObject({
    startsOn: null,
    endsOn: null,
    editionYear: null,
    dateState: "unknown",
    scheduleStatus: "announced",
  });
  expect(client.prepare("SELECT count(*) FROM events").pluck().get()).toBe(0);

  const stored = fx.event({ summary: null });
  const draft = fx.edition(stored, { startsOn: null });
  expect(stored.summary).toBeNull();
  expect(draft.startsOn).toBeNull();
  expect(draft.endsOn).toBeNull();
});

test("scenario helpers create distinct public records and typed relationships", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const first = fx.publishedEvent({ editions: [{}, {}] });
  const second = fx.publishedEvent();
  const [edition, sibling] = first.editions;

  expect(first.event.slug).not.toBe(second.event.slug);
  expect([edition.editionKey, sibling.editionKey]).toEqual(["2027", "2027-2"]);
  expect(
    client
      .prepare("SELECT path FROM url_aliases WHERE edition_id=?")
      .get(sibling.id),
  ).toMatchObject({ path: `/events/${first.event.slug}/2027-2` });
  expect(
    client
      .prepare("SELECT count(*) FROM edition_terms WHERE edition_id=?")
      .pluck()
      .get(edition.id),
  ).toBe(3);

  const link = fx.editionLink(edition, {
    kind: "ticketing",
  });
  expect(link.editionId).toBe(edition.id);
  expect(link.eventId).toBeNull();
  expect(
    client.prepare("SELECT count(*) FROM catalog_changes").pluck().get(),
  ).toBe(0);
});

test("scenario publication reuses terms created through the low-level API", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const festival = fx.term({
    facet: "event_type",
    slug: "festival",
    name: "Festival",
  });

  const { editions } = fx.publishedEvent();
  expect(
    client
      .prepare(
        "SELECT term_id FROM edition_terms WHERE edition_id=? AND term_id=?",
      )
      .get(editions[0].id, festival.id),
  ).toMatchObject({ term_id: festival.id });
});

test("generated URLs skip values explicitly supplied in the same fixture", () => {
  const fx = testFixtures();
  const { event } = fx.publishedEvent();
  fx.eventLink(event, { url: "https://example.org/test-link-2" });
  expect(fx.eventLink(event).url).toBe("https://example.org/test-link-1");
  expect(fx.eventLink(event).url).toBe("https://example.org/test-link-3");
});

test("generated term slugs skip explicit values within each facet", () => {
  const fx = testFixtures();
  fx.term({ slug: "test-genre-2" });
  expect(fx.term().slug).toBe("test-genre-3");
  expect(fx.term({ facet: "topic", slug: "test-genre-5" }).slug).toBe(
    "test-genre-5",
  );
  expect(fx.term().slug).toBe("test-genre-5");
  expect(fx.build.term().slug).toBe("test-genre-6");
});

test("a failed published scenario rolls back every related insert", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);

  expect(() =>
    fx.publishedEvent({ editions: [{}, { startsOn: null }] }),
  ).toThrow();
  for (const table of [
    "events",
    "editions",
    "taxonomy_terms",
    "edition_terms",
    "url_aliases",
  ]) {
    expect(client.prepare(`SELECT count(*) FROM ${table}`).pluck().get()).toBe(
      0,
    );
  }
});

test("fixture writes validate links, aliases, prices and taxonomy before insertion", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const parent = fx.term({ facet: "genre" });
  expect(() =>
    fx.eventLink(event, { kind: "future" as "official_site" }),
  ).toThrow();
  expect(() => fx.alias(event, { scope: "future" })).toThrow();
  expect(() => fx.edition(event, { priceCurrency: "EUR" })).toThrow(/price/);
  expect(() => fx.term({ facet: "topic", parentId: parent.id })).toThrow(
    /same facet/,
  );
  const first = fx.term({ facet: "event_type" });
  const second = fx.term({ facet: "event_type" });
  fx.assignTerm(edition, first);
  expect(() => fx.assignTerm(edition, second)).toThrow(/Only one/);
  for (const table of ["external_links", "url_aliases"]) {
    expect(client.prepare(`SELECT count(*) FROM ${table}`).pluck().get()).toBe(
      0,
    );
  }
  expect(
    client.prepare("SELECT count(*) FROM edition_terms").pluck().get(),
  ).toBe(1);
  expect(client.prepare("SELECT count(*) FROM editions").pluck().get()).toBe(1);
});

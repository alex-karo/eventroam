import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { seedDevelopmentFixtures } from "./development-fixtures";

const tables = [
  "events",
  "editions",
  "taxonomy_terms",
  "edition_terms",
  "external_links",
  "url_aliases",
];
test("development fixtures remain repeatable and bypass audit", () => {
  const { client } = testDatabase();
  const snapshot = () =>
    tables.map((table) =>
      client.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    );
  const id = seedDevelopmentFixtures(client);
  const before = snapshot();
  expect(seedDevelopmentFixtures(client)).toBe(id);
  expect(snapshot()).toEqual(before);
  expect(
    client.prepare("SELECT count(*) FROM catalog_changes").pluck().get(),
  ).toBe(0);
});

test("development fixtures require migrated terms without adding catalog records", () => {
  const { client } = testDatabase();
  client
    .prepare(
      "DELETE FROM taxonomy_terms WHERE facet='format' AND slug='openair'",
    )
    .run();
  const before = tables.map((table) =>
    client.prepare(`SELECT * FROM ${table}`).all(),
  );
  expect(() => seedDevelopmentFixtures(client)).toThrow(
    /Missing development fixture term: format\/openair/,
  );
  expect(
    tables.map((table) => client.prepare(`SELECT * FROM ${table}`).all()),
  ).toEqual(before);
});

test("development fixtures reuse imported vocabulary IDs", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  client
    .prepare(
      "DELETE FROM taxonomy_terms WHERE facet='event_type' AND slug='festival'",
    )
    .run();
  const imported = fx.term({
    id: "imported-festival",
    facet: "event_type",
    slug: "festival",
  });
  const terms = client
    .prepare("SELECT * FROM taxonomy_terms ORDER BY id")
    .all();
  seedDevelopmentFixtures(client);
  expect(
    client.prepare("SELECT * FROM taxonomy_terms ORDER BY id").all(),
  ).toEqual(terms);
  expect(
    client
      .prepare("SELECT DISTINCT term_id FROM edition_terms WHERE term_id=?")
      .pluck()
      .all(imported.id),
  ).toEqual([imported.id]);
});

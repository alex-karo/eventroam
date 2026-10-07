import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { seedDevelopmentFixtures } from "./development-fixtures";

const tables = [
  "events",
  "occurrences",
  "taxonomy_terms",
  "occurrence_terms",
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

test("a taxonomy validation failure rolls back the entire development seed", () => {
  const { client } = testDatabase();
  // A previously supplied term conflicts with the fixture's single-valued facets.
  testFixtures(client).term({ id: "dev-outdoor", facet: "event_type" });
  const before = tables.map((table) =>
    client.prepare(`SELECT * FROM ${table}`).all(),
  );
  expect(() => seedDevelopmentFixtures(client)).toThrow(/Only one event_type/);
  expect(
    tables.map((table) => client.prepare(`SELECT * FROM ${table}`).all()),
  ).toEqual(before);
});

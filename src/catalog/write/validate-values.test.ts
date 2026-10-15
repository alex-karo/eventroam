import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { validateCatalogValues } from "./validate-values";

test("taxonomy record validation loads children before accepting a changed facet", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const parent = fx.term({ facet: "genre" });
  fx.term({ facet: "genre", parentId: parent.id });
  expect(() =>
    client.transaction(() => {
      validateCatalogValues(client, "taxonomy_terms", {
        ...parent,
        facet: "topic",
      });
      client
        .prepare("UPDATE taxonomy_terms SET facet='topic' WHERE id=?")
        .run(parent.id);
    })(),
  ).toThrow(/children must be in same facet/);
  expect(
    client
      .prepare("SELECT facet FROM taxonomy_terms WHERE id=?")
      .get(parent.id),
  ).toEqual({ facet: "genre" });
});

test("fixture validation rejects invalid values before persistence", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const before = client.prepare("SELECT * FROM editions").all();
  for (const values of [
    { sizeEstimate: 0 },
    { sizeEstimate: 1.5 },
    { version: 0 },
    { priceDetails: {} },
    { priceDetails: [{ label: "Pass", amount: 10 }] },
    { latitude: 1 },
  ]) {
    expect(() => fx.edition(event, values as never)).toThrow();
    expect(client.prepare("SELECT * FROM editions").all()).toEqual(before);
  }
  expect(() => fx.event({ version: -1 })).toThrow();
  for (const values of [{}, { eventId: event.id, editionId: "other" }]) {
    expect(() =>
      client.transaction(() =>
        validateCatalogValues(client, "external_links", {
          kind: "official_site",
          ...values,
        }),
      )(),
    ).toThrow(/exactly one owner/);
  }
  expect(() =>
    fx.edition(event, { sizeEstimate: null, priceDetails: [], version: 2 }),
  ).not.toThrow();
});

test("related-state validation requires a transaction and rejects cycles and foreign aliases", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const parent = fx.term();
  const child = fx.term({ parentId: parent.id });
  const leaf = fx.term({ parentId: child.id });
  for (const parentId of [parent.id, leaf.id]) {
    expect(() =>
      client.transaction(() => {
        validateCatalogValues(client, "taxonomy_terms", {
          ...parent,
          parentId,
        });
        client
          .prepare("UPDATE taxonomy_terms SET parent_id=? WHERE id=?")
          .run(parentId, parent.id);
      })(),
    ).toThrow(/cycle/);
  }
  expect(() => validateCatalogValues(client, "taxonomy_terms", parent)).toThrow(
    /transaction/,
  );
  const event = fx.event();
  const other = fx.event();
  const edition = fx.edition(event);
  expect(() => fx.alias(other, { edition })).toThrow(/belong/);
  expect(client.prepare("SELECT * FROM url_aliases").all()).toEqual([]);
  expect(() => fx.alias(event, { edition })).not.toThrow();
});

test("taxonomy validation terminates on an already malformed ancestor chain", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const parent = fx.term();
  const child = fx.term({ parentId: parent.id });
  client
    .prepare("UPDATE taxonomy_terms SET parent_id=? WHERE id=?")
    .run(child.id, parent.id);
  expect(() => fx.term({ parentId: child.id })).toThrow(/cycle/);
  expect(client.prepare("SELECT id FROM taxonomy_terms").all()).toHaveLength(2);
});

import { applyCatalogOperation } from "./apply-operation";
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
  const before = client.prepare("SELECT * FROM taxonomy_terms").all();
  expect(() => fx.term({ parentId: child.id })).toThrow(/cycle/);
  expect(client.prepare("SELECT * FROM taxonomy_terms").all()).toEqual(before);
});

test("fixtures and operations reject the same invalid Edition scalars without writes", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const snapshot = () =>
    ["editions", "catalog_changes", "operation_receipts"].map((table) =>
      client.prepare(`SELECT * FROM ${table}`).all(),
    );
  const before = snapshot();
  for (const values of [
    { startsOn: "2027-02-29", endsOn: "2027-02-29" },
    { startsOn: "not-a-date", endsOn: "not-a-date" },
    { editionYear: 0 },
    { editionYear: 10000 },
    { editionYear: 2027.5 },
    { countryCode: "ZZ" },
    { countryCode: "pt" },
    { timeZone: "Not/A_Zone" },
    { timeZone: "" },
  ]) {
    expect(() => fx.edition(event, values)).toThrow();
    expect(() =>
      applyCatalogOperation(client, {
        kind: "createEdition",
        actor: "test",
        operationKey: "invalid-scalars",
        eventId: event.id,
        data: {
          editionKey: "test",
          startsOn: "2027-07-01",
          endsOn: "2027-07-01",
          dateState: "confirmed",
          ...values,
        },
      }),
    ).toThrow();
    expect(snapshot()).toEqual(before);
  }
  for (const editionYear of [1, 9999]) {
    expect(() =>
      fx.edition(event, { editionYear, timeZone: "Europe/Lisbon" }),
    ).not.toThrow();
  }
});

test("fixture assignments reject ancestors through unassigned terms in either order", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const parent = fx.term();
  const middle = fx.term({ parentId: parent.id });
  const leaf = fx.term({ parentId: middle.id });
  for (const [first, second] of [
    [parent, leaf],
    [leaf, parent],
  ]) {
    const edition = fx.edition(event);
    fx.assignTerm(edition, first);
    const before = client.prepare("SELECT * FROM edition_terms").all();
    expect(() => fx.assignTerm(edition, second)).toThrow(/redundant ancestor/);
    expect(client.prepare("SELECT * FROM edition_terms").all()).toEqual(before);
  }
  const edition = fx.edition(event);
  const sibling = fx.term({ parentId: middle.id });
  expect(() => {
    fx.assignTerm(edition, leaf);
    fx.assignTerm(edition, sibling);
  }).not.toThrow();
});

import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { migrateCatalogConnection } from "@/db/migrate";
import { taxonomyTerms } from "@/db/schema";
import { validateCatalogValues } from "@/catalog/write/validate-values";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";

test("fresh migration creates the current catalog structure", () => {
  const { client } = testDatabase();
  const objects = client
    .prepare(
      "SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY type,name",
    )
    .all() as { type: string; name: string }[];

  expect(
    objects.filter(({ type }) => type === "table").map(({ name }) => name),
  ).toEqual([
    "catalog_changes",
    "edition_terms",
    "editions",
    "events",
    "external_links",
    "ingestion_runs",
    "operation_receipts",
    "taxonomy_terms",
    "url_aliases",
  ]);
  expect(
    objects.filter(({ type }) => type === "index").map(({ name }) => name),
  ).toEqual([
    "catalog_changes_edition_operation_uq",
    "catalog_changes_event_operation_uq",
    "editions_coordinates_idx",
    "editions_country_idx",
    "editions_date_idx",
    "editions_event_idx",
    "editions_event_key_uq",
    "events_slug_uq",
    "external_links_edition_uq",
    "external_links_event_uq",
    "taxonomy_terms_facet_slug_uq",
  ]);
  expect(
    objects.filter(({ type }) => type === "trigger").map(({ name }) => name),
  ).toEqual([
    "catalog_changes_immutable_delete",
    "catalog_changes_immutable_update",
    "url_aliases_immutable_delete",
    "url_aliases_immutable_update",
  ]);
  expect(
    client.prepare("SELECT * FROM __drizzle_migrations").all(),
  ).toHaveLength(2);
  expect(client.pragma("foreign_keys", { simple: true })).toBe(1);
  expect(client.pragma("foreign_key_check")).toEqual([]);
  expect(client.pragma("integrity_check", { simple: true })).toBe("ok");
  expect(
    (
      client.pragma("table_info('editions')") as {
        name: string;
        dflt_value: string | null;
      }[]
    ).find(({ name }) => name === "price_details")?.dflt_value,
  ).toBe("'[]'");
});

test("fresh migration loads a valid starter vocabulary without catalog records", () => {
  const { client, db } = testDatabase();
  const terms = db.select().from(taxonomyTerms).all();
  expect(terms.length).toBeGreaterThan(0);
  client.transaction(() => {
    for (const term of terms) {
      validateCatalogValues(client, "taxonomy_terms", term);
    }
  })();
  for (const table of ["events", "editions", "edition_terms"]) {
    expect(client.prepare(`SELECT count(*) FROM ${table}`).pluck().get()).toBe(
      0,
    );
  }
});

test("starter vocabulary preserves imported terms and assignments", () => {
  const { client, db } = testDatabase();
  const vocabulary = db.select().from(taxonomyTerms).all();
  const child = vocabulary.find((term) => term.parentId)!;
  const parent = vocabulary.find((term) => term.id === child.parentId)!;
  db.delete(taxonomyTerms).run();
  const fx = testFixtures(client);
  const custom = fx.term({ facet: parent.facet });
  const imported = fx.term({
    ...parent,
    id: "imported-parent",
    name: "Imported parent",
    parentId: custom.id,
  });
  const event = fx.event();
  const edition = fx.edition(event);
  fx.assignTerm(edition, imported);
  const oldTerms = db.select().from(taxonomyTerms).all();
  const assignments = client.prepare("SELECT * FROM edition_terms").all();

  // The data migration needs only the existing schema, already supplied by the test database.
  client.transaction(() =>
    client.exec(
      readFileSync("src/db/migrations/0001_starter_taxonomy.sql", "utf8"),
    ),
  )();

  const terms = db.select().from(taxonomyTerms).all();
  expect(terms).toEqual(
    expect.arrayContaining([
      ...oldTerms,
      expect.objectContaining({
        facet: child.facet,
        slug: child.slug,
        parentId: imported.id,
      }),
    ]),
  );
  expect(client.prepare("SELECT * FROM edition_terms").all()).toEqual(
    assignments,
  );
});

test("repeating migration preserves data, journal and immutable history", () => {
  const connection = testDatabase();
  const { client } = connection;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  fx.assignTerm(edition, fx.term());
  const alias = fx.alias(event, { edition });
  client
    .prepare(
      "INSERT INTO catalog_changes(id,event_id,subject_version,changed_fields,operation_key,actor,changed_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run("change", event.id, 1, "[]", "migration-test", "owner", "2026-10-17");

  const before = client
    .prepare(
      "SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name",
    )
    .all();
  const migrations = client.prepare("SELECT * FROM __drizzle_migrations").all();
  const rows = client.prepare("SELECT * FROM editions").all();
  const terms = client
    .prepare("SELECT * FROM taxonomy_terms ORDER BY id")
    .all();
  const assignments = client.prepare("SELECT * FROM edition_terms").all();
  migrateCatalogConnection(connection);

  expect(
    client
      .prepare(
        "SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name",
      )
      .all(),
  ).toEqual(before);
  expect(client.prepare("SELECT * FROM __drizzle_migrations").all()).toEqual(
    migrations,
  );
  expect(client.prepare("SELECT * FROM editions").all()).toEqual(rows);
  expect(
    client.prepare("SELECT * FROM taxonomy_terms ORDER BY id").all(),
  ).toEqual(terms);
  expect(client.prepare("SELECT * FROM edition_terms").all()).toEqual(
    assignments,
  );
  expect(() =>
    client
      .prepare("UPDATE url_aliases SET path='/changed' WHERE path=?")
      .run(alias.path),
  ).toThrow(/immutable/);
  expect(() =>
    client.prepare("DELETE FROM url_aliases WHERE path=?").run(alias.path),
  ).toThrow(/immutable/);
  expect(() =>
    client
      .prepare("UPDATE catalog_changes SET actor='other' WHERE id='change'")
      .run(),
  ).toThrow(/immutable/);
  expect(() =>
    client.prepare("DELETE FROM catalog_changes WHERE id='change'").run(),
  ).toThrow(/immutable/);
});

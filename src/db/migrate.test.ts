import { expect, test } from "vitest";
import { migrateCatalogConnection } from "@/db/migrate";
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
  ).toHaveLength(1);
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

test("repeating migration preserves data, journal and immutable history", () => {
  const connection = testDatabase();
  const { client } = connection;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
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

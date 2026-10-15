import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";

test("SQLite accepts value rules while retaining relational integrity", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const term = fx.term({ facet: "event_type" });
  const second = fx.term({ facet: "event_type" });
  const link = fx.eventLink(event);
  client
    .prepare(
      "UPDATE events SET publication_state='future',home_scope='future' WHERE id=?",
    )
    .run(event.id);
  client
    .prepare(
      "UPDATE editions SET schedule_status='future',date_state='unknown',coordinate_precision='exact',publication_state='published',country_code=NULL,price_currency='bad' WHERE id=?",
    )
    .run(edition.id);
  client
    .prepare("UPDATE external_links SET kind='future' WHERE id=?")
    .run(link.id);
  client
    .prepare(
      "INSERT INTO url_aliases(scope,path,event_id,created_at) VALUES('future','/future',?,'today')",
    )
    .run(event.id);
  client
    .prepare("INSERT INTO edition_terms(edition_id,term_id) VALUES(?,?),(?,?)")
    .run(edition.id, term.id, edition.id, second.id);
  client
    .prepare("UPDATE taxonomy_terms SET facet='future',parent_id=? WHERE id=?")
    .run(term.id, second.id);
  for (const assignment of [
    "starts_on=NULL",
    "ends_on='2000-01-01'",
    "latitude=1",
    "latitude=91,longitude=0",
    "size_estimate=0",
    "version=0",
    "price_details='{}'",
  ]) {
    expect(() =>
      client
        .prepare(`UPDATE editions SET ${assignment} WHERE id=?`)
        .run(edition.id),
    ).not.toThrow();
  }
  for (const assignment of ["event_id='missing'", "edition_key=NULL"]) {
    expect(() =>
      client
        .prepare(`UPDATE editions SET ${assignment} WHERE id=?`)
        .run(edition.id),
    ).toThrow();
  }
  expect(() =>
    client.prepare("UPDATE events SET version=0 WHERE id=?").run(event.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("UPDATE external_links SET event_id=NULL WHERE id=?")
      .run(link.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("UPDATE external_links SET edition_id=? WHERE id=?")
      .run(edition.id, link.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("UPDATE taxonomy_terms SET parent_id=id WHERE id=?")
      .run(term.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("INSERT INTO events SELECT * FROM events WHERE id=?")
      .run(event.id),
  ).toThrow();
  expect(client.pragma("foreign_key_check")).toEqual([]);
});

test("fresh schema has no CHECK constraints and retains exactly four history triggers", () => {
  const { client } = testDatabase();
  expect(
    client
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND upper(sql) LIKE '%CHECK%'",
      )
      .all(),
  ).toEqual([]);
  expect(
    client
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='trigger' ORDER BY name",
      )
      .all(),
  ).toEqual([
    { name: "catalog_changes_immutable_delete" },
    { name: "catalog_changes_immutable_update" },
    { name: "url_aliases_immutable_delete" },
    { name: "url_aliases_immutable_update" },
  ]);
});

import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { openDatabase } from "@/db/connection";
import { migrateCatalogConnection } from "@/db/migrate";

test("populated catalog migration preserves identities, foreign keys, indexes and immutable audit", () => {
  const directory = mkdtempSync(join(tmpdir(), "eventroam-old-schema-"));
  const path = join(directory, "catalog.sqlite");
  try {
    const old = new Database(path);
    const first = readFileSync(
      "src/db/migrations/0000_living_the_stranger.sql",
      "utf8",
    );
    for (const statement of first.split("--> statement-breakpoint"))
      if (statement.trim()) old.exec(statement);
    old.exec(
      "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    old
      .prepare("INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)")
      .run("initial", 1790888155747);
    old
      .prepare(
        "INSERT INTO events(id,slug,canonical_name,created_at,updated_at) VALUES('event-old','old-festival','Old Festival','2026-01-01','2026-01-01')",
      )
      .run();
    old
      .prepare(
        "INSERT INTO occurrences(id,event_id,occurrence_key,created_at,updated_at) VALUES('edition-old','event-old','2027','2026-01-01','2026-01-01')",
      )
      .run();
    old
      .prepare(
        "INSERT INTO catalog_changes(id,occurrence_id,subject_version,changed_fields,operation_key,actor,changed_at) VALUES('change-old','edition-old',1,'[]','old:change','owner','2026-01-01')",
      )
      .run();
    old
      .prepare(
        "INSERT INTO external_links(id,occurrence_id,kind,url,official,created_at,updated_at) VALUES('link-old','edition-old','official_site','https://example.org',1,'2026-01-01','2026-01-01')",
      )
      .run();
    old.close();
    const connection = openDatabase(path);
    try {
      migrateCatalogConnection(connection);
      const { client } = connection;
      expect(client.pragma("foreign_key_check")).toEqual([]);
      expect(client.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(
        client
          .prepare("SELECT id,event_id,price_details,version FROM occurrences")
          .get(),
      ).toEqual({
        id: "edition-old",
        event_id: "event-old",
        price_details: "[]",
        version: 1,
      });
      expect(
        client.prepare("SELECT id,operation_key FROM catalog_changes").get(),
      ).toEqual({
        id: "change-old",
        operation_key: "old:change",
      });
      expect(client.prepare("SELECT id FROM external_links").get()).toEqual({
        id: "link-old",
      });
      expect(
        (client.pragma("index_list('occurrences')") as { name: string }[]).some(
          (index) => index.name === "occurrences_event_key_uq",
        ),
      ).toBe(true);
      expect(() =>
        client
          .prepare(
            "UPDATE catalog_changes SET note='changed' WHERE id='change-old'",
          )
          .run(),
      ).toThrow(/immutable/);
      expect(() =>
        client
          .prepare("DELETE FROM catalog_changes WHERE id='change-old'")
          .run(),
      ).toThrow(/immutable/);
      expect(() =>
        client
          .prepare(
            "UPDATE occurrences SET price_details='{}' WHERE id='edition-old'",
          )
          .run(),
      ).toThrow();
      client
        .prepare(
          "UPDATE occurrences SET ticket_availability='closed' WHERE id='edition-old'",
        )
        .run();
      expect(
        client
          .prepare(
            "SELECT ticket_availability FROM occurrences WHERE id='edition-old'",
          )
          .get(),
      ).toEqual({ ticket_availability: "closed" });
    } finally {
      connection.client.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

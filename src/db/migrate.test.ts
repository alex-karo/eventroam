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
    for (const statement of first.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        old.exec(statement);
      }
    }
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
          .prepare("SELECT id,event_id,price_details,version FROM editions")
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
        (client.pragma("index_list('editions')") as { name: string }[]).some(
          (index) => index.name === "editions_event_key_uq",
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
            "UPDATE editions SET price_details='{}' WHERE id='edition-old'",
          )
          .run(),
      ).toThrow();
      expect(
        (client.pragma("table_info('editions')") as { name: string }[]).map(
          (column) => column.name,
        ),
      ).not.toContain("ticket_availability");
    } finally {
      connection.client.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Exercise the migration from each released schema, with every catalog table populated.
for (const from of [0, 1, 2, 3, 4]) {
  test(`catalog migration preserves retained data from 000${from}`, async () => {
    const { testFixtures } = await import("@/test/fixtures");
    const directory = mkdtempSync(
      join(tmpdir(), "eventroam-validation-migration-"),
    );
    const connection = openDatabase(join(directory, "catalog.sqlite"));
    const { client } = connection;
    try {
      const journal = JSON.parse(
        readFileSync("src/db/migrations/meta/_journal.json", "utf8"),
      ) as {
        entries: { idx: number; tag: string; when: number }[];
      };
      client.exec(
        "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
      );
      for (const entry of journal.entries.filter(
        (entry) => entry.idx <= from,
      )) {
        const sql = readFileSync(`src/db/migrations/${entry.tag}.sql`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint")) {
          if (statement.trim()) {
            client.exec(statement);
          }
        }
        client
          .prepare(
            "INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)",
          )
          .run(entry.tag, entry.when);
      }
      const fx = testFixtures(client);
      const event = { id: "event" };
      const edition = { id: "edition" };
      const parentTerm = { id: "parent" };
      const childTerm = { id: "child" };
      let seedSql = `
        INSERT INTO events(id,slug,canonical_name,home_scope,publication_state,created_at,updated_at)
          VALUES('event','festival','Festival','festivals','published','2026-10-01','2026-10-01');
        INSERT INTO occurrences(id,event_id,occurrence_key,occurrence_year,starts_on,ends_on,date_state,
          schedule_status,country_code,locality,publication_state,price_kind,price_currency,price_min_minor,
          price_max_minor,price_coverage,price_qualification,created_at,updated_at)
          VALUES('edition','event','2027',2027,'2027-06-01','2027-06-02','confirmed','scheduled','PT','Lisbon',
            'published','range','EUR',12000,15000,'full_programme','Fees included','2026-10-01','2026-10-01');
        INSERT INTO taxonomy_terms(id,facet,slug,name,parent_id) VALUES
          ('parent','genre','electronic','Electronic',NULL),('child','genre','house','House','parent'),
          ('type','event_type','festival','Festival',NULL),('format','format','outdoor','Outdoor',NULL);
        INSERT INTO occurrence_terms(occurrence_id,term_id) VALUES('edition','child'),('edition','type'),('edition','format');
        INSERT INTO sources(id,canonical_url,kind,authority,created_at,updated_at)
          VALUES('source','https://example.org','website','official','2026-10-01','2026-10-01');
        INSERT INTO source_subjects(source_id,event_id) VALUES('source','event');
        INSERT INTO external_links(id,occurrence_id,kind,url,official,source_id,created_at,updated_at)
          VALUES('link','edition','official_site','https://example.org',1,'source','2026-10-01','2026-10-01');
        INSERT INTO url_aliases(scope,path,event_id,occurrence_id,created_at) VALUES
          ('festivals','/events/festival','event',NULL,'2026-10-01'),
          ('festivals','/events/festival/2027','event','edition','2026-10-01');
      `;
      if (from >= 3) {
        seedSql = seedSql
          .replace(
            /        INSERT INTO sources[\s\S]*?INSERT INTO external_links/,
            "        INSERT INTO external_links",
          )
          .replace("official,source_id,created_at", "official,created_at")
          .replace("1,'source','2026-10-01'", "1,'2026-10-01'");
      }
      client.exec(seedSql);
      client.exec(`UPDATE occurrences SET version=7,display_name='Second weekend',capacity_estimate=9000,
        venue_name='Park',venue_address='Main Street',administrative_area='Lisbon',latitude=38.72,longitude=-9.14,
        coordinate_precision='exact',time_zone='Europe/Lisbon';
        UPDATE events SET version=3,aliases='["Other name"]',summary='Known summary';`);
      if (from >= 1) {
        client
          .prepare(
            `UPDATE occurrences SET ${from < 3 ? "ticket_availability='closed'," : ""}price_details=? WHERE id='edition'`,
          )
          .run(
            JSON.stringify([
              {
                label: "Pass",
                amount: 120,
                currency: "EUR",
                availability: "available",
                terms: "Full programme",
                url: "https://example.org/tickets",
              },
            ]),
          );
      }
      client
        .prepare(
          "INSERT INTO catalog_changes(id,event_id,subject_version,changed_fields,operation_key,actor,changed_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          "audit",
          event.id,
          1,
          '[{"field":"occurrence_year","oldValue":2026,"newValue":2027}]',
          "op",
          "owner",
          "2026-10-01",
        );
      client
        .prepare(
          "INSERT INTO operation_receipts(operation_key,payload_hash,result,applied_at) VALUES(?,?,?,?)",
        )
        .run(
          "op",
          "hash",
          '{"id":"edition","version":7,"changed":true,"occurrenceKey":"2027"}',
          "2026-10-01",
        );
      const tables = [
        "events",
        "occurrences",
        "taxonomy_terms",
        "occurrence_terms",
        "external_links",
        "url_aliases",
        "catalog_changes",
        "operation_receipts",
      ];
      if (from === 4) {
        const report =
          '{"schemaVersion":2,"mode":"refresh","runId":"old-run","operations":[{"kind":"updateOccurrence","data":{"occurrenceYear":2027}}]}';
        client
          .prepare(
            `INSERT INTO ingestion_runs(id,event_id,mode,status,started_at,finished_at,input_json,report_json,input_tokens,output_tokens,search_cost_estimate_usd,duration_ms,usage_complete)
          VALUES('old-run','event','refresh','completed','2026-10-01','2026-10-01','{"mode":"refresh"}',?,0,0,0,1,1)`,
          )
          .run(report);
        tables.push("ingestion_runs");
      }
      const currentName = (name: string) =>
        name.replaceAll("occurrence", "edition");
      const snapshot = () =>
        Object.fromEntries(
          tables.map((table) => [
            currentName(table),
            client
              .prepare(
                `SELECT * FROM ${client.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table) ? table : currentName(table)} ORDER BY rowid`,
              )
              .all()
              .map((record) => {
                const retained = { ...(record as Record<string, unknown>) };
                if (table === "occurrences") {
                  delete retained.ticket_availability;
                } else if (table === "external_links") {
                  delete retained.source_id;
                }
                return Object.fromEntries(
                  Object.entries(retained).map(([key, value]) => [
                    currentName(key),
                    value,
                  ]),
                );
              }),
          ]),
        );
      const before = snapshot();
      if (from === 0) {
        before.editions = before.editions.map((record) => ({
          ...(record as object),
          price_details: "[]",
        }));
      }
      const indexes = () =>
        client
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name NOT IN ('sources','source_subjects','ingestion_runs') ORDER BY name",
          )
          .all()
          .map((row) => ({ name: currentName((row as { name: string }).name) }))
          .sort((a, b) => a.name.localeCompare(b.name));
      const beforeIndexes = indexes();
      migrateCatalogConnection(connection);
      expect(snapshot()).toEqual(before);
      expect(indexes()).toEqual(beforeIndexes);
      expect(
        client
          .prepare(
            "SELECT name FROM sqlite_schema WHERE sql LIKE '%occurrence%' AND name != '__drizzle_migrations'",
          )
          .all(),
      ).toEqual([]);
      if (from === 4) {
        expect(() =>
          client.exec(
            "UPDATE ingestion_runs SET report_json=json_set(report_json,'$.schemaVersion',3) WHERE id='old-run'",
          ),
        ).toThrow(/ingestion_runs_report_ck/);
      }
      expect(
        client
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('sources','source_subjects')",
          )
          .all(),
      ).toEqual([]);
      expect(
        (client.pragma("table_info('editions')") as { name: string }[]).map(
          (column) => column.name,
        ),
      ).not.toContain("ticket_availability");
      expect(
        (
          client.pragma("table_info('external_links')") as { name: string }[]
        ).map((column) => column.name),
      ).not.toContain("source_id");
      expect(
        (
          client.pragma("foreign_key_list('external_links')") as {
            table: string;
          }[]
        )
          .map((foreignKey) => foreignKey.table)
          .sort(),
      ).toEqual(["editions", "events"]);
      const migrations = client
        .prepare("SELECT * FROM __drizzle_migrations")
        .all();
      migrateCatalogConnection(connection);
      expect(snapshot()).toEqual(before);
      expect(
        client.prepare("SELECT * FROM __drizzle_migrations").all(),
      ).toEqual(migrations);
      expect(client.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(client.pragma("foreign_key_check")).toEqual([]);
      expect(client.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(
        client
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='trigger' ORDER BY name",
          )
          .all(),
      ).toEqual([
        { name: "catalog_changes_immutable_delete" },
        { name: "catalog_changes_immutable_update" },
        { name: "taxonomy_parent_cycle_update" },
        { name: "url_aliases_edition_owner_insert" },
        { name: "url_aliases_immutable_delete" },
        { name: "url_aliases_immutable_update" },
      ]);
      expect(() =>
        client
          .prepare("UPDATE taxonomy_terms SET parent_id=? WHERE id=?")
          .run(childTerm.id, parentTerm.id),
      ).toThrow(/cycle/);
      expect(() => client.exec("UPDATE url_aliases SET path='/other'")).toThrow(
        /immutable/,
      );
      expect(() => client.exec("DELETE FROM url_aliases")).toThrow(/immutable/);
      expect(() =>
        client.exec("UPDATE catalog_changes SET actor='other'"),
      ).toThrow(/immutable/);
      expect(() => client.exec("DELETE FROM catalog_changes")).toThrow(
        /immutable/,
      );
      const other = fx.event();
      expect(() =>
        client
          .prepare(
            "INSERT INTO url_aliases(scope,path,event_id,edition_id,created_at) VALUES('festivals','/wrong-owner',?,?, '2026-10-01')",
          )
          .run(other.id, edition.id),
      ).toThrow(/belong/);
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

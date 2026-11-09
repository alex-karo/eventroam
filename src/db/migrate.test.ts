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
    "ingestion_jobs",
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
    "ingestion_jobs_batch_position_uq",
    "ingestion_jobs_queue_idx",
    "ingestion_runs_job_idx",
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
  ).toHaveLength(8);
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

function restorePreSellOutSchema(
  client: ReturnType<typeof testDatabase>["client"],
) {
  client.exec(`
    ALTER TABLE editions DROP COLUMN sold_out_source_url;
    DELETE FROM __drizzle_migrations
      WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations);
  `);
}

test("sell-out migration preserves an existing Edition", () => {
  const connection = testDatabase();
  const { client } = connection;
  const fixtures = testFixtures(client);
  const edition = fixtures.edition(fixtures.event(), {
    priceDetails: [{ label: "Early Bird", availability: "sold_out" }],
  });
  restorePreSellOutSchema(client);

  migrateCatalogConnection(connection);

  expect(
    client.prepare("SELECT * FROM editions WHERE id = ?").get(edition.id),
  ).toMatchObject({
    edition_key: edition.editionKey,
    price_details: JSON.stringify(edition.priceDetails),
    sold_out_source_url: null,
  });
});

function restoreSummarySchema(
  client: ReturnType<typeof testDatabase>["client"],
) {
  restorePreSellOutSchema(client);
  client.exec(`
    ALTER TABLE events DROP COLUMN short_description;
    ALTER TABLE events RENAME COLUMN description TO summary;
    DELETE FROM __drizzle_migrations
      WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations);
  `);
}

test("description migration preserves saved text and nulls", () => {
  const connection = testDatabase();
  const { client } = connection;
  const fx = testFixtures(client);
  const filled = fx.event({ description: "An open-air festival." });
  const blank = fx.event({ description: null });
  restoreSummarySchema(client);

  migrateCatalogConnection(connection);

  const read = client.prepare(
    "SELECT description, short_description FROM events WHERE id=?",
  );
  expect(read.get(filled.id)).toEqual({
    description: "An open-air festival.",
    short_description: null,
  });
  expect(read.get(blank.id)).toEqual({
    description: null,
    short_description: null,
  });
});

test.each([
  { version: "0003", hasAddJobs: false },
  { version: "0004", hasAddJobs: true },
])(
  "job migration from $version preserves the queue and run links",
  ({ hasAddJobs }) => {
    const connection = testDatabase();
    const { client } = connection;
    const event = testFixtures(client).event();
    restoreSummarySchema(client);
    const note = '  Festival "name"\nhttps://organizer.test/\n';
    client.pragma("foreign_keys = OFF");
    client.exec("DROP TABLE ingestion_jobs");
    client.exec(
      readFileSync("src/db/migrations/0003_ingestion_jobs.sql", "utf8").split(
        "ALTER TABLE",
      )[0],
    );
    if (hasAddJobs) {
      client.exec(
        readFileSync("src/db/migrations/0004_add_job_inputs.sql", "utf8"),
      );
    }
    client
      .prepare(
        "INSERT INTO ingestion_jobs(id,batch_id,position,event_id,scope,dry_run,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "refresh-job",
        "refresh-batch",
        0,
        event.id,
        "current",
        0,
        "running",
        "2026-11-01",
      );
    if (hasAddJobs) {
      client
        .prepare(
          "INSERT INTO ingestion_jobs(id,batch_id,position,add_input,dry_run,status,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run("add-job", "add-batch", 1, note, 1, "cancelled", "2026-11-01");
    }
    client
      .prepare(
        "INSERT INTO ingestion_runs(id,job_id,mode,status,started_at,input_json) VALUES('attempt','refresh-job','refresh','running','2026-11-01','{}')",
      )
      .run();
    client
      .prepare(
        "DELETE FROM __drizzle_migrations WHERE created_at IN (SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT ?)",
      )
      .run(hasAddJobs ? 1 : 2);
    client.pragma("foreign_keys = ON");
    const rootPage = client
      .prepare("SELECT rootpage FROM sqlite_schema WHERE name='ingestion_jobs'")
      .pluck();
    const oldRootPage = rootPage.get();

    migrateCatalogConnection(connection);

    const rows = client
      .prepare(
        "SELECT id,batch_id,position,mode,input,dry_run,status,created_at FROM ingestion_jobs ORDER BY position",
      )
      .all() as { input: string }[];
    expect(
      rows.map((row) => ({ ...row, input: JSON.parse(row.input) })),
    ).toEqual([
      {
        id: "refresh-job",
        batch_id: "refresh-batch",
        position: 0,
        mode: "refresh",
        input: { eventId: event.id, scope: "current" },
        dry_run: 0,
        status: "running",
        created_at: "2026-11-01",
      },
      ...(hasAddJobs
        ? [
            {
              id: "add-job",
              batch_id: "add-batch",
              position: 1,
              mode: "add",
              input: note,
              dry_run: 1,
              status: "cancelled",
              created_at: "2026-11-01",
            },
          ]
        : []),
    ]);
    if (hasAddJobs) {
      expect(rootPage.get()).toBe(oldRootPage);
    }
    expect(
      client
        .prepare("SELECT job_id FROM ingestion_runs WHERE id='attempt'")
        .pluck()
        .get(),
    ).toBe("refresh-job");
    expect(client.pragma("foreign_key_check")).toEqual([]);
    expect(client.pragma("index_list(ingestion_jobs)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ingestion_jobs_batch_position_uq" }),
        expect.objectContaining({ name: "ingestion_jobs_queue_idx" }),
      ]),
    );
  },
);

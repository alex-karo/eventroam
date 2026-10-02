import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { readDatabaseEnvironment } from "@/db/env";
import { openReadDatabase } from "@/db/connection";
import { testFixtures } from "@/test/fixtures";

test("SQLite settings and Drizzle work against a real database file", () => {
  const { client, db } = testDatabase();

  expect(client.pragma("foreign_keys", { simple: true })).toBe(1);
  expect(client.pragma("journal_mode", { simple: true })).toBe("wal");
  expect(client.pragma("busy_timeout", { simple: true })).toBe(5000);

  db.run(sql`CREATE TABLE parent (id INTEGER PRIMARY KEY)`);
  db.run(
    sql`CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id))`,
  );
  db.run(sql`INSERT INTO parent (id) VALUES (1)`);
  db.run(sql`INSERT INTO child (id, parent_id) VALUES (2, 1)`);
  expect(
    db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM child`),
  ).toEqual({ count: 1 });
  expect(() =>
    db.run(sql`INSERT INTO child (id, parent_id) VALUES (3, 999)`),
  ).toThrow();
});

test("database environment rejects an empty path", () => {
  expect(() => readDatabaseEnvironment({ DATABASE_PATH: " " })).toThrow();
});

test("public reader is read-only and sees committed writes on later reads", () => {
  const writer = testDatabase();
  const reader = openReadDatabase(writer.path);
  try {
    expect(
      reader.client.prepare("SELECT count(*) FROM sources").pluck().get(),
    ).toBe(0);
    expect(() =>
      reader.client.exec("CREATE TABLE unexpected (id INTEGER)"),
    ).toThrow(/readonly/i);
    writer.client.exec("BEGIN");
    try {
      testFixtures(writer.client).source({ id: "committed" });
      expect(
        reader.client.prepare("SELECT count(*) FROM sources").pluck().get(),
      ).toBe(0);
      writer.client.exec("COMMIT");
    } catch (error) {
      writer.client.exec("ROLLBACK");
      throw error;
    }
    expect(
      reader.client.prepare("SELECT count(*) FROM sources").pluck().get(),
    ).toBe(1);
  } finally {
    reader.client.close();
  }
});

test("public reader requires an existing database", () => {
  const writer = testDatabase();
  expect(() => openReadDatabase(`${writer.path}.missing`)).toThrow();
});

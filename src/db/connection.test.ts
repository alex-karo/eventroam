import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { openDatabase } from "./connection";
import { readDatabaseEnvironment } from "./env";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SQLite settings and Drizzle work against a real database file", () => {
  const directory = mkdtempSync(join(tmpdir(), "eventroam-sqlite-"));
  temporaryDirectories.push(directory);
  const { client, db } = openDatabase(join(directory, "catalog.sqlite"));

  try {
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
  } finally {
    client.close();
  }
});

test("database environment rejects an empty path", () => {
  expect(() => readDatabaseEnvironment({ DATABASE_PATH: " " })).toThrow();
});

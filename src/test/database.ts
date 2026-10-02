import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "@/db/connection";

type TestDatabase = ReturnType<typeof openDatabase> & {
  path: string;
  close: () => void;
};

let current: TestDatabase | undefined;
let active = false;
const opened: TestDatabase[] = [];

/** Always passes a unique temporary path, never the application's default. */
export function createTestDatabase() {
  if (!active)
    throw new Error("Test database can only be created during a test");
  const directory = mkdtempSync(join(tmpdir(), "eventroam-test-"));
  const path = join(directory, "catalog.sqlite");
  let connection: ReturnType<typeof openDatabase> | undefined;
  try {
    connection = openDatabase(path);
    migrate(connection.db, { migrationsFolder: "./src/db/migrations" });
    const { client } = connection;
    const result: TestDatabase = {
      ...connection,
      path,
      close: () => {
        try {
          client.close();
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    };
    opened.push(result);
    return result;
  } catch (error) {
    connection?.client.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Installed by Vitest's setup file before every test. */
export function beginTestDatabase() {
  active = true;
}

export function testDatabase() {
  if (!active) throw new Error("Test database is only available during a test");
  current ??= createTestDatabase();
  return current;
}

/** Installed by Vitest's setup file after every test. */
export function endTestDatabase() {
  active = false;
  current = undefined;
  for (const database of opened.splice(0).reverse()) database.close();
}

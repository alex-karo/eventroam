import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readDatabaseEnvironment } from "./env";

export function openDatabase(
  databasePath: string = readDatabaseEnvironment().DATABASE_PATH,
) {
  if (databasePath.trim().length === 0) {
    throw new Error("DATABASE_PATH must not be empty");
  }

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const client = new Database(databasePath);

  try {
    client.pragma("foreign_keys = ON");
    client.pragma("journal_mode = WAL");
    client.pragma("busy_timeout = 5000");

    if (client.pragma("foreign_keys", { simple: true }) !== 1) {
      throw new Error("SQLite foreign key enforcement is unavailable");
    }

    return { client, db: drizzle(client) };
  } catch (error) {
    client.close();
    throw error;
  }
}

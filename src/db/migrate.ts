import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "./connection";

export function migrateDatabase(path?: string) {
  const connection = openDatabase(path);
  try {
    migrate(connection.db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    connection.client.close();
  }
}

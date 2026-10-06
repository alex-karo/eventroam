import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "@/db/connection";

export function migrateCatalogConnection(
  connection: ReturnType<typeof openDatabase>,
) {
  const { client, db } = connection;
  if (client.inTransaction)
    throw new Error("Catalog migration needs its own connection");
  client.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    client.pragma("foreign_keys = ON");
  }
  const violations = client.pragma("foreign_key_check") as unknown[];
  if (violations.length)
    throw new Error("Catalog migration has foreign key violations");
  if (client.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("Catalog migration failed integrity check");
}

export function migrateDatabase(path?: string) {
  const connection = openDatabase(path);
  try {
    migrateCatalogConnection(connection);
  } finally {
    connection.client.close();
  }
}

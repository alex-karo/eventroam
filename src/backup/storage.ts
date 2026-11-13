import { lstatSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DuckDBConnection } from "@mastra/duckdb";

const databaseFiles = [
  "eventroam.sqlite",
  "mastra-workflows.sqlite",
  "mastra-chat.sqlite",
  "mastra-evals.sqlite",
  "mastra-observability.duckdb",
] as const;

function checkSQLite(file: string, checkpoint: boolean) {
  const db = new Database(file, { fileMustExist: true, readonly: !checkpoint });
  try {
    if (checkpoint) {
      db.pragma("busy_timeout = 5000");
      const checkpointResult = db.pragma("wal_checkpoint(TRUNCATE)") as {
        busy: number;
      }[];
      if (checkpointResult[0].busy !== 0) {
        throw new Error("Database is busy; stop its users before backup");
      }
    }
    const check = db.pragma("integrity_check") as { integrity_check: string }[];
    if (check.length !== 1 || check[0].integrity_check !== "ok") {
      throw new Error(`SQLite integrity check failed: ${file}`);
    }
    if ((db.pragma("foreign_key_check") as unknown[]).length) {
      throw new Error(`SQLite foreign key check failed: ${file}`);
    }
  } finally {
    db.close();
  }
}

export async function checkDatabases(root: string, checkpoint: boolean) {
  for (const name of databaseFiles) {
    const file = join(root, name);
    if (!lstatSync(file).isFile()) {
      throw new Error(`Expected a regular file: ${file}`);
    }
    if (!name.endsWith(".duckdb")) {
      checkSQLite(file, checkpoint);
      continue;
    }
    const db = new DuckDBConnection({
      path: file,
      threads: 1,
      memoryLimit: "512MB",
    });
    try {
      await db.query("SELECT count(*) FROM information_schema.tables");
      if (checkpoint) {
        await db.execute("CHECKPOINT");
      }
    } finally {
      await db.close();
    }
  }
}

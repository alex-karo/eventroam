import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { GET } from "@/app/health/route";

const directory = mkdtempSync(join(tmpdir(), "eventroam-health-"));
beforeEach(() => {
  mkdirSync(directory, { recursive: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

test("health fails without creating the catalog or its directory", async () => {
  const path = join(directory, "missing", "catalog.sqlite");
  vi.stubEnv("DATABASE_PATH", path);
  const response = GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
  expect(existsSync(join(directory, "missing"))).toBe(false);
});

test("health rejects an incompatible catalog and does not disclose records", async () => {
  const path = join(directory, "bad.sqlite");
  const client = new Database(path);
  client.exec(
    "CREATE TABLE private_records (secret TEXT); INSERT INTO private_records VALUES ('PRIVATE_HEALTH_SENTINEL')",
  );
  client.close();
  const before = readFileSync(path);
  vi.stubEnv("DATABASE_PATH", path);
  expect(GET().status).toBe(503);
  expect(await GET().text()).toBe('{"status":"unavailable"}');
  expect(readFileSync(path)).toEqual(before);
});

test("health accepts a migrated catalog without changing it", async () => {
  const path = join(directory, "ok.sqlite");
  migrateDatabase(path);
  const before = readFileSync(path);
  vi.stubEnv("DATABASE_PATH", path);
  const response = GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(readFileSync(path)).toEqual(before);
});

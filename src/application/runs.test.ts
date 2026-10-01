import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { applyCatalogOperation } from "./catalog";
import {
  finishIngestionRun,
  recordSourceCheck,
  startIngestionRun,
} from "./runs";

test("source-check results replay by key, complete immutably, and dry runs cannot mutate catalog", () => {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-runs-"));
  const { client, db } = openDatabase(join(dir, "catalog.sqlite"));
  try {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
    client
      .prepare(
        "INSERT INTO sources (id,canonical_url,kind,authority,created_at,updated_at) VALUES ('source','https://example.org/','website','official','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
      )
      .run();
    const id = startIngestionRun(client, {
      mode: "dry_run",
      initiatedBy: "owner",
      adapterVersions: { fixture: "1" },
    });
    const result = {
      key: "check-1",
      sourceId: "source",
      checkedAt: "2026-10-01T12:00:00Z",
      outcome: "unchanged" as const,
      inspectedUrl: "https://example.org/",
      authority: "official" as const,
      excerpt: "Unchanged fixture",
    };
    expect(recordSourceCheck(client, id, result)).toBe(true);
    expect(recordSourceCheck(client, id, result)).toBe(false);
    expect(() =>
      recordSourceCheck(client, id, { ...result, outcome: "changed" }),
    ).toThrow(/different payload/);
    expect(() =>
      applyCatalogOperation(client, {
        kind: "createEvent",
        operationKey: "dry-write",
        actor: "agent",
        ingestionRunId: id,
        data: { slug: "no-write", canonicalName: "No write" },
        evidence: [
          {
            sourceId: "source",
            inspectedUrl: "https://example.org/",
            retrievedAt: "2026-10-01T12:00:00Z",
            authority: "official",
            fieldPaths: ["slug", "canonical_name"],
            excerpt: "Fictional source",
          },
        ],
      }),
    ).toThrow(/active apply run/);
    expect(
      (client.prepare("SELECT count(*) n FROM events").get() as { n: number })
        .n,
    ).toBe(0);
    finishIngestionRun(client, id, "succeeded", {
      checked: 1,
      created: 0,
      updated: 0,
      published: 0,
      unchanged: 1,
      skipped: 0,
      failed: 0,
    });
    expect(recordSourceCheck(client, id, result)).toBe(false);
    expect(() =>
      recordSourceCheck(client, id, { ...result, outcome: "changed" }),
    ).toThrow(/different payload/);
    expect(() =>
      recordSourceCheck(client, id, { ...result, key: "check-2" }),
    ).toThrow(/not active/);
    expect(() =>
      recordSourceCheck(client, id, {
        ...result,
        key: "check-3",
        excerpt: undefined,
      }),
    ).toThrow(/excerpt or snapshot/);
    expect(() =>
      client
        .prepare("UPDATE ingestion_runs SET status='failed' WHERE id=?")
        .run(id),
    ).toThrow(/immutable/);
    expect(() =>
      client.prepare("DELETE FROM ingestion_runs WHERE id=?").run(id),
    ).toThrow(/immutable/);
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

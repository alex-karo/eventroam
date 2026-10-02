import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { applyCatalogOperation } from "@/catalog/write/apply-operation";
import {
  finishIngestionRun,
  recordSourceCheck,
  startIngestionRun,
} from "@/catalog/write/runs";

test("source-check results replay by key, complete immutably, and dry runs cannot mutate catalog", () => {
  const { client } = testDatabase();
  testFixtures(client).source({
    id: "source",
    canonicalUrl: "https://example.org/",
  });
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
    }),
  ).toThrow(/active apply run/);
  expect(
    (client.prepare("SELECT count(*) n FROM events").get() as { n: number }).n,
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
    client
      .prepare("UPDATE ingestion_runs SET status='failed' WHERE id=?")
      .run(id),
  ).toThrow(/immutable/);
  expect(() =>
    client.prepare("DELETE FROM ingestion_runs WHERE id=?").run(id),
  ).toThrow(/immutable/);
});

import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import {
  traceText,
  traceUrl,
  runTraceLabel,
  contextEditions,
  committedEditions,
  validatedTraceName,
  boundedEditions,
} from "./labels";

test("UTF-8 bounds preserve code points and explicit omissions, with explicit omissions", () => {
  const text = traceText("🎉".repeat(300), 512);
  expect(Buffer.byteLength(text)).toBeLessThanOrEqual(512);
  expect(text).not.toContain("�");
  expect(text.endsWith("…")).toBe(true);
  expect(traceUrl("https://example.org/path?api_key=public#fragment")).toEqual({
    url: "https://example.org/path?api_key=public#fragment",
    truncated: false,
  });
  const editions = Array.from({ length: 30 }, (_, index) => ({
    editionKey: `summer${index}`,
    year: null,
  }));
  expect(boundedEditions(editions)).toMatchObject({
    entries: expect.any(Array),
    omitted: 20,
  });
});
test.each(["add", "refresh", "check"] as const)(
  "%s label reserves terminal result and mode while retaining nonyear keys",
  (mode) => {
    const label = runTraceLabel(
      "🎉".repeat(400),
      mode,
      [{ editionKey: "summer", year: 2026 }],
      [{ editionKey: "2026", year: 2027, role: "updated" }],
      "write-failed",
    );
    expect(Buffer.byteLength(label)).toBeLessThanOrEqual(512);
    expect(label).toContain("ctx:2026 [key:summer]");
    expect(label).toContain("updated:2027 [key:2026]");
    expect(label).toContain(`${mode} · write-failed`);
    expect(label).not.toMatch(/apply|found/);
    expect(
      runTraceLabel("Festival", mode, [{ editionKey: "2026", year: null }], []),
    ).toContain("? [key:2026]");
  },
);
test("canonical identity, context snapshots and effective years follow writer receipts", () => {
  const { client } = testDatabase();
  const fixtures = testFixtures(client);
  const event = fixtures.event({ canonicalName: "Canonical Festival" });
  const edition = fixtures.occurrence(event, {
    occurrenceKey: "2026",
    occurrenceYear: 2026,
  });
  fixtures.event({ canonicalName: "Unrelated" });
  const catalog = readResearchCatalog(client);
  const input = {
    mode: "check" as const,
    eventId: event.id,
    name: "Wrong",
    actor: "test",
  };
  expect(validatedTraceName(input, catalog, null)).toBe("Canonical Festival");
  const context = contextEditions(catalog, event.id);
  const applied = applyCatalogItem(client, [
    {
      kind: "updateOccurrence",
      id: edition.id,
      expectedVersion: edition.version,
      data: { occurrenceYear: 2027 },
      operationKey: "trace-year",
      actor: "test",
    },
  ]);
  expect(context).toEqual([
    { occurrenceId: edition.id, editionKey: "2026", year: 2026 },
  ]);
  expect(committedEditions(applied, catalog)).toEqual([
    {
      occurrenceId: edition.id,
      editionKey: "2026",
      year: 2027,
      role: "updated",
    },
  ]);
  expect(committedEditions(null, catalog)).toEqual([]);
});

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
  terminalProjection,
  validatedTraceName,
  boundedEditions,
  readProjection,
  discoveryProjection,
  boundTraceProjection,
  type TraceRunState,
} from "./trace-projections";
import type { ReadSourceResult } from "../sources/contracts";

const state: TraceRunState = {
  structuralValidation: "passed",
  targetValidation: "passed",
  writeState: "committed",
};
test("UTF-8 bounds preserve code points and explicit omissions, including escaped JSON", () => {
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
  const source = discoveryProjection("🎉".repeat(500), "ok", {
    query: "",
    candidates: Array.from({ length: 20 }, () => ({
      url: "\\".repeat(600),
      title: "PRIVATE",
    })),
    retrievedAt: "",
    modelCostUsd: null,
    searchCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
  const bounded = boundTraceProjection(source, 8192);
  expect(
    Buffer.byteLength(
      JSON.stringify({ input: bounded.input, output: bounded.output }),
    ),
  ).toBeLessThanOrEqual(8192);
  expect(bounded.output.retainedCount + bounded.output.omittedCount).toBe(20);
  expect(source.output.retainedCount).toBe(10);
  expect(JSON.stringify(bounded)).not.toContain("PRIVATE");
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
  const output = terminalProjection(
    state,
    undefined,
    applied,
    context,
    committedEditions(applied, catalog),
  );
  expect(output).toMatchObject({
    committedOperationCount: 1,
    semanticValidation: "not_run",
  });
  expect(output).not.toHaveProperty("researchStatus");
  expect(output).not.toHaveProperty("technicalStatus");
  expect(
    terminalProjection(
      { ...state, writeState: "unknown" },
      undefined,
      null,
      [],
      [],
    ).committedOperationCount,
  ).toBeNull();
});
test.each(["http", "firecrawl", "social_stub"] as const)(
  "read projection retains %s independently from outcome and tool truncation",
  (method) => {
    for (const outcome of [
      "ok",
      "partial",
      "unsupported",
      "blocked",
      "failed",
    ] as const) {
      const read: ReadSourceResult = {
        attemptedUrl: "https://example.org/a",
        finalUrl: "https://example.org/b?token=public#fragment",
        method,
        outcome,
        reason: "source_content_truncated",
        completeness: "partial",
        markdown: "PRIVATE",
        links: [],
        retrievedAt: "",
      };
      expect(
        readProjection(read.attemptedUrl, read, false, true).output,
      ).toMatchObject({
        method,
        outcome,
        sourceTruncated: true,
        toolTruncated: false,
        cached: true,
        finalUrl: read.finalUrl,
      });
      expect(
        JSON.stringify(readProjection(read.attemptedUrl, read)),
      ).not.toContain("PRIVATE");
    }
    expect(readProjection("https://example.org").output).toMatchObject({
      method: "unknown",
      sourceTruncated: "unknown",
      toolTruncated: "unknown",
    });
  },
);
test.each(["ok", "not_run", "failed"] as const)(
  "discovery %s retains query and status without titles",
  (status) => {
    const projection = discoveryProjection(
      "https://example.org/p?token=public#f",
      status,
    );
    expect(projection.input.query).toBe("https://example.org/p?token=public#f");
    expect(projection.output).toMatchObject({ status, returnedCount: 0 });
  },
);

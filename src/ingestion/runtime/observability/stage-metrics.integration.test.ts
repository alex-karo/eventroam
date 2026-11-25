import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { beforeEach, expect, test, vi } from "vitest";
import { readResearchCatalog } from "@/catalog/read/research";
import type { GenerateRole } from "@/ingestion/roles/invoke";
import {
  createChatMemory,
  StudioMastra,
} from "@/mastra/catalog-assistant/memory";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  fixtureDependencies,
  fixtureTool,
  fixtureUrl,
  runFixtureResearch,
} from "@/test/ingestion";
import { shutdownIngestionStageMetrics } from "./stage-metrics";

type SentEvent = {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
};

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "eventroam-stage-metrics-"));
  vi.stubEnv("CATALOG_SOURCE_DIRECTORY", root);
  vi.stubEnv("CATALOG_TRACING", "false");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_stage_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://analytics.example.test");
  return async () => {
    await shutdownIngestionStageMetrics();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  };
});

const dates = "Example Fest 2027, July 1–3, Lisbon, Portugal.";
const detail = "🎵 PRIVATE_PASSAGE";
const context = "Portugal";
const page = `${dates}\n${detail}\n${context}\nMore text outside the marked area.\n`;

function receiveEvents(rejectBatch = false) {
  const events: SentEvent[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(String(url)).toBe("https://analytics.example.test/batch/");
    const request = new Request(url, init);
    const body = Buffer.from(await request.arrayBuffer());
    const payload = JSON.parse(
      request.headers.get("content-encoding") === "gzip"
        ? gunzipSync(body).toString()
        : body.toString(),
    ) as { batch: SentEvent[] };
    events.push(...payload.batch);
    return new Response("", { status: rejectBatch ? 503 : 200 });
  });
  return events;
}

test.each(["preview", "committed", "failed"] as const)(
  "records source work and writer receipts for a %s run",
  async (status) => {
    const { client, path } = testDatabase();
    if (status === "failed") {
      client.exec(
        "CREATE TRIGGER refuse_edition BEFORE INSERT ON editions BEGIN SELECT RAISE(ABORT, 'PRIVATE_WRITE_ERROR'); END",
      );
    }
    // The apply run must finish even if PostHog rejects every batch.
    if (status === "committed") {
      vi.spyOn(console, "error").mockImplementation(() => {});
    }
    const events = receiveEvents(status === "committed");
    const dryRun = status === "preview";
    const result = await runFixtureResearch(
      { mode: "add", input: "Example Fest", actor: "PRIVATE_ACTOR", dryRun },
      {
        client,
        todayUtc: "2026-11-01",
        ...fixtureDependencies({
          reader: {
            overview: "PRIVATE_OVERVIEW",
            coverage: { found: [], notPublished: [] },
            topics: ["dates"],
            statedYears: ["2027"],
            limitations: [],
            evidence: [
              {
                quote: { start: 1, end: 2 },
                context: [1, 3],
                topics: ["identity", "dates", "location"],
                editionClues: [],
                uncertainty: null,
              },
              { quote: 2, topics: ["dates"] },
            ],
          },
          research: (async (_role, prompt, call) => {
            const { checks } = JSON.parse(prompt) as {
              checks: { key: string }[];
            };
            const alias = `${fixtureUrl}alias`;
            await fixtureTool(call, "searchWeb", { query: "PRIVATE_QUERY" });
            for (const url of [fixtureUrl, alias, `${fixtureUrl}other`]) {
              await fixtureTool(call, "inspectPage", { url });
            }
            return {
              checks: checks.slice(0, -1).map(({ key }, index) => ({
                check: key,
                sourceIds: index === 1 ? [] : ["s1"],
                blocker: index === 0 ? "PRIVATE_BLOCKER" : null,
              })),
              unresolved: [],
            };
          }) satisfies GenerateRole,
        }),
        readPage: async (url, { budget }) => {
          budget.consumePage();
          return {
            attemptedUrl: url,
            finalUrl: url.endsWith("/alias") ? fixtureUrl : url,
            retrievedAt: "2026-11-01T00:00:00Z",
            method: "http",
            status: "ok",
            markdown: page,
          };
        },
        searchWeb: async (query, { budget }) => {
          budget.consumeSearch();
          budget.consumeSearch();
          return {
            query,
            retrievedAt: "2026-11-01T00:00:00Z",
            candidates: [
              { url: fixtureUrl, title: "PRIVATE_TITLE", highlights: [] },
            ],
          };
        },
      },
    );
    const failed = status === "failed";
    expect(result.errors).toEqual(
      failed ? [expect.objectContaining({ code: "write_failed" })] : [],
    );
    expect(result.outcome).toBe(failed ? "failed" : "created");
    expect(readResearchCatalog(client)).toHaveLength(
      status === "committed" ? 1 : 0,
    );

    expect(events).toHaveLength(0);
    const chat = await createChatMemory(join(dirname(path), "chat.sqlite"));
    await new StudioMastra({ logger: false }, chat).shutdown();
    expect(fetch).toHaveBeenCalledTimes(1);

    const named = (event: string) =>
      events.filter((item) => item.event === event);
    expect(named("ingestion_research_finished")).toMatchObject([
      {
        properties: {
          status: "completed",
          pages_read: 2,
          pages_with_evidence: 2,
          searches_completed: 1,
          assigned_checks: 10,
          returned_checks: 9,
          blocked_checks: 1,
          checks_with_evidence: 7,
        },
      },
    ]);
    const covered = dates.length + 1 + detail.length;
    const readerEvents = named("ingestion_reader_finished").toSorted((a, b) =>
      String(a.properties.source_id).localeCompare(
        String(b.properties.source_id),
      ),
    );
    expect(readerEvents).toMatchObject(
      ["s1", "s2"].map((source_id) => ({
        properties: {
          source_id,
          processing: "complete",
          evidence_count: 2,
          page_utf16_units: page.length,
          marked_utf16_units: covered + context.length,
          marked_percent: (100 * (covered + context.length)) / page.length,
        },
      })),
    );
    expect(named("ingestion_editor_finished")).toMatchObject([
      {
        properties: { status: "completed", review_calls: 1 },
      },
    ]);
    const changedCount = result.receipts.filter(
      ({ changed }) => changed,
    ).length;
    const writeEvents = named("ingestion_catalog_write_finished");
    expect(writeEvents).toMatchObject([
      {
        properties: {
          outcome: result.outcome,
          dry_run: dryRun,
          changed_operations: changedCount,
          changed_operation_kinds: failed
            ? []
            : expect.arrayContaining(["createEvent", "createEdition"]),
        },
      },
    ]);
    expect(writeEvents[0].properties).not.toHaveProperty("status");
    for (const event of events) {
      expect(event.distinct_id).toBe(`ingestion:${result.runId}`);
      expect(event.properties).toMatchObject({
        run_id: result.runId,
        mode: "add",
        scope: null,
        dry_run: dryRun,
        $process_person_profile: false,
      });
    }
    const sentProperties = new Set(
      events.flatMap(({ properties }) => Object.keys(properties)),
    );
    for (const property of [
      "missing_checks",
      "searches_with_candidates",
      "quote_utf16_units",
      "return_rounds",
      "page_attempts",
      "search_attempts",
      "committed_operations",
    ]) {
      expect(sentProperties).not.toContain(property);
    }
    expect(JSON.stringify(events)).not.toMatch(
      /PRIVATE_|example\.org|Example Fest/,
    );
  },
);

test("records an unchanged write when the writer receipts have no changes", async () => {
  const { client } = testDatabase();
  const fixtures = testFixtures(client);
  const event = fixtures.event({ canonicalName: "Example Fest" });
  fixtures.eventLink(event, { url: fixtureUrl, kind: "official_site" });
  fixtures.edition(event, { editionKey: "2027", endsOn: "2027-07-03" });
  const events = receiveEvents();
  const result = await runFixtureResearch(
    {
      mode: "refresh",
      scope: "current",
      eventId: event.id,
      actor: "catalog-research",
      dryRun: false,
    },
    { client, todayUtc: "2026-11-01", ...fixtureDependencies() },
  );
  expect(result.errors).toEqual([]);
  expect(result.outcome).toBe("unchanged");
  expect(result.receipts).toMatchObject([{ changed: false }]);
  await shutdownIngestionStageMetrics();
  expect(
    events.filter(({ event }) => event === "ingestion_catalog_write_finished"),
  ).toMatchObject([
    {
      properties: {
        run_id: result.runId,
        outcome: "unchanged",
        dry_run: false,
        planned_operations: 1,
        changed_operations: 0,
        changed_operation_kinds: [],
      },
    },
  ]);
});

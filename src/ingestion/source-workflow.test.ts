import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { runCatalogResearch } from "./workflow";
import { createWorkflowStorage } from "./runtime/workflow-storage";
import type { GenerateRole } from "./roles/invoke";
import { locationTextFields } from "./location/contracts";

afterEach(() => vi.unstubAllEnvs());
function approve(schema: Record<string, unknown>): unknown {
  if (schema.type === "null") {
    return null;
  }
  const properties = schema.properties as
    Record<string, Record<string, unknown>> | undefined;
  if (properties?.decision) {
    return { decision: "approve", reason: "Fixture confirms the proposal" };
  }
  if (schema.type === "array") {
    return [];
  }
  return Object.fromEntries(
    Object.entries(properties ?? {}).map(([key, value]) => [
      key,
      approve(value),
    ]),
  );
}

async function fixture(invalidTickets = false) {
  const root = await mkdtemp(join(tmpdir(), "eventroam-workflow-source-"));
  vi.stubEnv("CATALOG_SOURCE_DIRECTORY", root);
  vi.stubEnv("CATALOG_TRACING", "false");
  const db = testDatabase();
  const f = testFixtures();
  const event = f.event({ canonicalName: "Example Festival" });
  f.link(
    { event },
    { kind: "official_site", official: true, url: "https://example.org/" },
  );
  const storage = createWorkflowStorage({ path: ":memory:" });
  const calls: string[] = [];
  let classificationStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    classificationStarted = resolve;
  });
  const generate: GenerateRole = async (role, prompt) => {
    calls.push(role);
    const input = JSON.parse(prompt);
    if (role === "reader") {
      return {
        overview: "Official 2027 dates, place and tickets",
        topics: ["identity", "dates", "tickets", "location", "links"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: input.page,
            context: [],
            topics: [
              "identity",
              "description",
              "dates",
              "tickets",
              "location",
              "links",
              "classification",
            ],
            editionClues: ["2027"],
            uncertainty: null,
          },
        ],
      };
    }
    if (role === "research") {
      return {
        checks: input.checks.map((check: { key: string }) => ({
          check: check.key,
          finding: "verified",
          explanation: "Source was inspected",
          evidenceIds: [],
          sourceIds: input.inspectedPages.map(
            (page: { sourceId: string }) => page.sourceId,
          ),
        })),
        completionReason: "All assigned checks resolved",
        unresolved: [],
      };
    }
    const checks = (input.assignedChecks ?? []).map((check: string) => ({
      check,
      finding: "verified",
      explanation: "Fixture completes interpretation",
      evidenceIds: [],
      sourceIds: [],
    }));
    const evidenceIds =
      input.corpus?.evidence.map((item: { id: string }) => item.id) ?? [];
    if (role === "general") {
      return {
        decision: "targets",
        eventId: event.id,
        observedEventName: "Example Festival",
        reason: "Same official festival",
        evidenceIds,
        event: {},
        previousEdition: null,
        currentOrNextEdition: {
          editionKey: "2027",
          reason: "Official new Edition",
          evidenceIds,
          fields: {
            year: {
              action: "set",
              value: 2027,
              reason: "Official year",
              evidenceIds,
            },
            dates: {
              action: "set",
              value: {
                startsOn: "2027-07-01",
                endsOn: "2027-07-03",
                state: "confirmed",
              },
              reason: "Official dates",
              evidenceIds,
            },
          },
        },
        checks,
        unresolved: [],
      };
    }
    if (role === "tickets") {
      await started;
      return invalidTickets
        ? { invalid: true }
        : {
            currentOrNextEdition: {
              tickets: {
                action: "set",
                value: {
                  variants: [
                    { label: "Full pass", amount: 100, currency: "EUR" },
                  ],
                  basePrice: {
                    kind: "exact",
                    currency: "EUR",
                    minAmount: 100,
                    maxAmount: 100,
                    coverage: "full_programme",
                  },
                },
                reason: "Official full pass",
                evidenceIds,
              },
            },
            checks,
            unresolved: [],
          };
    }
    if (role === "classification") {
      classificationStarted();
      return {
        previousEdition: null,
        currentOrNextEdition: {},
        checks,
        unresolved: [],
      };
    }
    if (role === "links") {
      return {
        event: {
          website: {
            action: "set",
            value: "https://example.org/",
            reason: "Official website",
            evidenceIds,
          },
          socials: {},
        },
        currentOrNextEdition: {},
        omitted: [],
        checks,
        unresolved: [],
      };
    }
    return approve(input.decisionShape);
  };
  try {
    const result = await runCatalogResearch(
      { mode: "refresh", eventId: event.id, actor: "test", dryRun: false },
      {
        client: db.client,
        workflowStorage: storage,
        todayUtc: "2026-10-31",
        generateRole: generate,
        readPage: async (url) => ({
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: "2026-10-31T00:00:00Z",
          status: "ok",
          method: "http",
          markdown:
            "# Example Festival 2027\n1–3 July 2027, Lisbon, Portugal. Full pass EUR 100. [Website](https://example.org/)",
        }),
        searchWeb: async () => {
          throw new Error("Unexpected discovery");
        },
        generateLocation: async (prompt) => {
          calls.push("location");
          const input = JSON.parse(prompt);
          return {
            decision: {
              status: "ready",
              previousEdition: null,
              currentOrNextEdition: {
                fields: Object.fromEntries(
                  locationTextFields.map((field) => [
                    field,
                    field === "countryCode"
                      ? { action: "set", value: "PT", reason: "Source country" }
                      : { action: "keep", reason: "No new fact" },
                  ]),
                ),
                coordinates: { action: "keep", reason: "No point" },
                evidenceIds: input.evidence.map(
                  (item: { id: string }) => item.id,
                ),
                unresolved: [],
              },
            },
          };
        },
      },
    );
    return { result, calls };
  } finally {
    await storage.close();
    await rm(root, { recursive: true, force: true });
  }
}
it("runs independent specialists in parallel and applies one reviewed complete block", async () => {
  const { result, calls } = await fixture();
  expect(result.errors).toEqual([]);
  expect(result.outcome).toBe("created");
  expect(result.modelResponse?.object).toHaveProperty("decision", "targets");
  expect(result.researchStatus).toBe("success");
  expect(calls.filter((role) => role === "reader")).toHaveLength(1);
  expect(calls.indexOf("editor")).toBeGreaterThan(calls.indexOf("location"));
  const prices = result.operations.find(
    (operation) => operation.kind === "replacePriceBlock",
  );
  expect(prices).toHaveProperty("priceDetails", [
    { label: "Full pass", amount: 100, currency: "EUR" },
  ]);
});
it("waits for branches and prevents all writes on invalid required output", async () => {
  const { result, calls } = await fixture(true);
  expect(result.outcome).toBe("failed");
  expect(calls).toContain("classification");
  expect(calls).toContain("location");
  expect(calls).not.toContain("editor");
  expect(result.operations).toEqual([]);
});

import { Mastra } from "@mastra/core/mastra";
import { createCatalogIngestionWorkflow } from "./workflow";
import { existsSync, readdirSync } from "node:fs";

it("keeps saved source references in workflow history after cancellation during another read", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-cancel-sources-"));
  vi.stubEnv("CATALOG_SOURCE_DIRECTORY", root);
  vi.stubEnv("CATALOG_TRACING", "false");
  const db = testDatabase();
  const fixtures = testFixtures();
  const event = fixtures.event();
  fixtures.link(
    { event },
    { kind: "official_site", official: true, url: "https://example.org/one" },
  );
  const storage = createWorkflowStorage({ path: ":memory:" });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let secondSignal: AbortSignal | undefined;
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const generate: GenerateRole = async (role, prompt, call) => {
    if (role === "reader") {
      return {
        overview: "Official page",
        topics: ["identity"],
        statedYears: [],
        limitations: [],
        evidence: [
          {
            quote: JSON.parse(prompt).page,
            topics: ["identity"],
            context: [],
            editionClues: [],
            uncertainty: null,
          },
        ],
      };
    }
    if (role !== "research") {
      throw new Error("Dependent role must not run");
    }
    const inspect = call.tools!.inspectPage as {
      execute: (input: unknown, context: unknown) => Promise<unknown>;
    };
    await inspect.execute({ url: "https://example.org/two" }, {});
    return {
      checks: [],
      completionReason: "Cancelled fixture",
      unresolved: [],
    };
  };
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: {
      client: db.client,
      workflowStorage: storage,
      generateRole: generate,
      readPage: async (url, { signal }) => {
        if (url.endsWith("/two")) {
          secondSignal = signal;
          entered();
          await hold;
        }
        return {
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: "2026-10-31T00:00:00Z",
          status: "ok",
          method: "http",
          markdown: `# Official festival ${url}`,
        };
      },
    },
  }));
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  try {
    const run = await workflow.createRun();
    const pending = run.start({
      inputData: {
        mode: "refresh",
        eventId: event.id,
        dryRun: false,
        republish: false,
      },
    });
    await started;
    const cancel = run.cancel();
    await vi.waitFor(() => expect(secondSignal?.aborted).toBe(true));
    release();
    await cancel;
    await pending;
    const domain = (await storage.getStore("workflows"))!;
    const snapshot = await domain.loadWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
    });
    const data = (
      snapshot?.value as unknown as {
        data: { corpus: import("./evidence/contracts").FrozenCorpus };
      }
    ).data;
    expect(data.corpus.sources).toHaveLength(1);
    const source = data.corpus.sources[0];
    expect(source).toMatchObject({
      id: "s1",
      processing: "complete",
      attemptedUrl: "https://example.org/one",
    });
    expect(existsSync(source.markdownPath!)).toBe(true);
    expect(existsSync(source.evidencePath!)).toBe(true);
    const files = readdirSync(join(root, readdirSync(root)[0], "sources"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(readdirSync(join(root, readdirSync(root)[0], "sources"))).toEqual(
      files,
    );
    await domain.deleteWorkflowRunById({
      workflowName: workflow.id,
      runId: run.runId,
    });
    expect(existsSync(source.markdownPath!)).toBe(true);
    expect(
      db.client.prepare("SELECT status FROM ingestion_runs").get(),
    ).toEqual({ status: "failed" });
  } finally {
    release();
    await host.shutdown();
    await storage.close();
    await rm(root, { recursive: true, force: true });
  }
});

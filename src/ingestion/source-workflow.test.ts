import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { runCatalogResearch } from "./workflow";
import { createWorkflowStorage } from "./runtime/workflow-storage";
import type { GenerateRole } from "./roles/invoke";
import type { CollectionOutput } from "./roles/research/contracts";
import { locationTextFields } from "./roles/location/contracts";
import { approveFixtureReview, wholeNumberedPage } from "@/test/ingestion";

afterEach(() => vi.unstubAllEnvs());
async function fixture(
  options: {
    invalidTickets?: boolean;
    sourceUnavailable?: boolean;
    uncertainIdentity?: boolean;
    unfinishedCheck?: string;
    research?: (output: CollectionOutput) => CollectionOutput;
  } = {},
) {
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
        coverage: { found: [], notPublished: [] },
        topics: ["identity", "dates", "tickets", "location", "links"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: wholeNumberedPage(input.page),
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
      const output: CollectionOutput = {
        checks: input.checks.map((check: { key: string }) => ({
          check: check.key,
          blocker: null,
          sourceIds: input.inspectedPages.map(
            (page: { sourceId: string }) => page.sourceId,
          ),
        })),
        unresolved: [],
      };
      return options.research?.(output) ?? output;
    }
    const checks = (input.assignedChecks ?? []).map((check: string) => ({
      check,
      finding: check === options.unfinishedCheck ? "unfinished" : "verified",
      explanation: "Fixture completes interpretation",
      evidenceIds: [],
      sourceIds: [],
    }));
    const evidenceIds =
      input.corpus?.evidence.map((item: { id: string }) => item.id) ?? [];
    if (role === "general") {
      if (options.uncertainIdentity) {
        return {
          decision: "uncertain",
          reason: "The inspected source does not confirm the saved Event.",
          unresolved: [{ message: "Confirm the Event identity." }],
        };
      }
      return {
        decision: "targets",
        eventId: event.id,
        observedEventName: "Example Festival",
        reason: "Same official festival",
        evidenceIds,
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
      return options.invalidTickets
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
    return approveFixtureReview(input.reviewPaths);
  };
  try {
    const result = await runCatalogResearch(
      { mode: "refresh", eventId: event.id, actor: "test", dryRun: false },
      {
        client: db.client,
        workflowStorage: storage,
        todayUtc: "2026-10-31",
        generateRole: generate,
        readPage: async (url) =>
          options.sourceUnavailable
            ? {
                attemptedUrl: url,
                finalUrl: url,
                retrievedAt: "2026-10-31T00:00:00Z",
                status: "failed",
                reasonCode: "http_error",
                method: "http",
                markdown: "",
              }
            : {
                attemptedUrl: url,
                finalUrl: url,
                retrievedAt: "2026-10-31T00:00:00Z",
                status: "ok",
                method: "http",
                markdown:
                  "# Example Festival 2027\n1–3 July 2027, Lisbon, Portugal. Full pass EUR 100. [Website](https://example.org/)",
              },
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
it("retains partial collection and prevents writes after General declines identity", async () => {
  const { result, calls } = await fixture({ uncertainIdentity: true });
  expect(result.outcome).toBe("failed");
  expect(result.researchStatus).toBe("partial");
  expect(result.modelResponse?.object).toHaveProperty("decision", "uncertain");
  expect(result.sourceSummaries.length).toBeGreaterThan(0);
  expect(result.operations).toEqual([]);
  expect(result.receipts).toEqual([]);
  expect(result.changes).toEqual([]);
  expect(result.references).toEqual({});
  expect(calls).toEqual(["reader", "research", "general"]);
});

it("waits for branches and prevents all writes on invalid required output", async () => {
  const { result, calls } = await fixture({ invalidTickets: true });
  expect(result.outcome).toBe("failed");
  expect(calls).toContain("classification");
  expect(calls).toContain("location");
  expect(calls).not.toContain("editor");
  expect(result.operations).toEqual([]);
});

it("keeps a long source blocker partial even when specialists verify their checks", async () => {
  const explanation = "The official travel page is blocked. ".repeat(12).trim();
  const question = {
    message: "Which official travel domain should be used? ".repeat(12).trim(),
  };
  const { result } = await fixture({
    research: (output) => ({
      checks: output.checks.map((check) =>
        check.check === "currentLocation"
          ? { ...check, blocker: explanation }
          : check,
      ),
      unresolved: [question],
    }),
  });
  expect(result.errors).toEqual([]);
  expect(result.researchStatus).toBe("partial");
  expect(result.unresolved).toContainEqual(question);
  expect(result.unresolved).toContainEqual({
    message: `currentLocation: ${explanation}`,
  });
  expect(
    result.sourceSummaries.some((source) =>
      source.information.includes(explanation),
    ),
  ).toBe(true);
});

it("does not treat a specialist finding as a completed missing collection check", async () => {
  const { result } = await fixture({
    research: (output) => ({
      ...output,
      checks: output.checks.filter(
        (check) => check.check !== "currentClassification",
      ),
    }),
  });
  expect(result.errors).toEqual([]);
  expect(result.outcome).toBe("created");
  expect(result.researchStatus).toBe("partial");
  expect(result.unresolved).toContainEqual({
    message: "Collection check currentClassification was not returned.",
  });
});

it("keeps a semantic check unfinished without an acquisition blocker", async () => {
  const { result } = await fixture({
    unfinishedCheck: "currentClassification",
  });
  expect(result.errors).toEqual([]);
  expect(result.researchStatus).toBe("partial");
  expect(result.unresolved).toContainEqual({
    message: "currentClassification: Fixture completes interpretation",
  });
});

it("rejects repeated collection keys before interpretation", async () => {
  const { result, calls } = await fixture({
    research: (output) => ({
      ...output,
      checks: [...output.checks, output.checks[0]],
    }),
  });
  expect(result.outcome).toBe("failed");
  expect(calls).not.toContain("general");
  expect(result.operations).toEqual([]);
});

it("retains an unfinished collection cause without a source or a separate owner question", async () => {
  const explanation = "All relevant source requests are blocked.";
  const { result, calls } = await fixture({
    sourceUnavailable: true,
    research: (output) => ({
      checks: output.checks.map((check) =>
        check.check === "currentTickets"
          ? {
              check: check.check,
              sourceIds: [],
              blocker: explanation,
            }
          : check,
      ),
      unresolved: [],
    }),
  });
  expect(result.outcome).toBe("failed");
  expect(result.researchStatus).toBe("failed");
  expect(calls).not.toContain("general");
  expect(result.unresolved).toContainEqual({
    message: `currentTickets: ${explanation}`,
  });
});

it("rejects an unknown collection source before interpretation or writes", async () => {
  const { result, calls } = await fixture({
    research: (output) => ({
      ...output,
      checks: output.checks.map((check) => ({
        ...check,
        sourceIds: ["unknown-source"],
      })),
    }),
  });
  expect(result.outcome).toBe("failed");
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "invalid_candidate",
      message: "Collection check references are invalid",
    }),
  );
  expect(calls).not.toContain("general");
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
        coverage: { found: [], notPublished: [] },
        topics: ["identity"],
        statedYears: [],
        limitations: [],
        evidence: [
          {
            quote: wholeNumberedPage(JSON.parse(prompt).page),
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
        input: { eventId: event.id, scope: "full" },
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
    const savedRun = db.client
      .prepare("SELECT id,started_at FROM ingestion_runs")
      .get() as { id: string; started_at: string };
    expect(readdirSync(root)).toEqual([
      `${savedRun.started_at.replaceAll(":", "-")}_${savedRun.id}`,
    ]);
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

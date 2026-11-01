import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { z } from "zod";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { loadResearchContext } from "../research/context";
import { bindEvidence } from "../evidence/contracts";
import { createCorpusStorage } from "../evidence/storage";
import { createResearchBudget } from "../runtime/budget";
import { initialDiagnostics, type PreparedProposals } from "../proposals";
import { runEditor, runGeneral } from "./run";

it.each(["add", "full", "current"] as const)(
  "keeps General identity and saved facts without other role instructions (%s)",
  async (mode) => {
    const db = testDatabase();
    const fixtures = testFixtures(db.client);
    const event = fixtures.event({
      aliases: ["Other festival name"],
      summary: "Saved description",
    });
    const edition = fixtures.edition(event, {
      editionKey: "import-next",
      sizeEstimate: 12000,
      timeZone: "Europe/Lisbon",
    });
    fixtures.link(
      { event },
      { kind: "official_site", official: true, url: "https://example.org/" },
    );
    const input =
      mode === "add"
        ? { mode: "add" as const, name: event.canonicalName, actor: "test" }
        : {
            mode: "refresh" as const,
            scope: mode,
            eventId: event.id,
            actor: "test",
          };
    const context = loadResearchContext(
      db.client,
      input,
      "2026-11-01T00:00:00Z",
    );
    const original = JSON.stringify(context);
    const budget = createResearchBudget();
    const execution = await runGeneral({
      input,
      context,
      corpus: { version: "fixture", sources: [], evidence: [] },
      budget,
      config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
      signal: new AbortController().signal,
      deps: {
        client: db.client,
        generateRole: async (_role, prompt) => {
          const data = JSON.parse(prompt);
          expect(Object.keys(data.assignment).sort()).toEqual([
            "currentDate",
            "identityContext",
            "identityTask",
            "permissions",
          ]);
          expect(data.assignment.permissions.eventFields).toBe(
            mode !== "current",
          );
          expect(data.assignedChecks).toContain("currentDates");
          expect(data.assignedChecks).not.toContain("currentTickets");
          expect(data.candidates[0]).toMatchObject({
            id: event.id,
            version: event.version,
            aliases: event.aliases,
            summary: event.summary,
            links: [{ kind: "official_site", url: "https://example.org/" }],
          });
          expect(data.candidates[0].editions[0]).toMatchObject({
            id: edition.id,
            eventId: event.id,
            editionKey: "import-next",
            sizeEstimate: 12000,
            countryCode: edition.countryCode,
            dateState: edition.dateState,
            timeZone: "Europe/Lisbon",
          });
          for (const field of [
            "priceDetails",
            "priceMinMinor",
            "terms",
            "latitude",
            "longitude",
            "createdAt",
            "updatedAt",
          ]) {
            expect(data.candidates[0].editions[0]).not.toHaveProperty(field);
          }
          return {
            decision: "uncertain",
            reason: "No source evidence supplied",
            unresolved: [],
          };
        },
      },
    });
    expect(execution.status).toBe("success");
    expect(JSON.stringify(context)).toBe(original);
  },
);

it("reads only additional cited context and retains source access and hash checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-editor-context-"));
  try {
    const body = "Before the quote. Festival in the park. After the quote.";
    const store = createCorpusStorage("editor-test", root);
    const source = await store.savePage({
      attemptedUrl: "https://example.org/",
      finalUrl: "https://example.org/",
      retrievedAt: "2026-11-01T00:00:00Z",
      method: "http",
      status: "ok",
      markdown: body,
    });
    const bound = bindEvidence(
      source.id,
      body,
      {
        overview: "Festival page",
        topics: ["description"],
        statedYears: [],
        limitations: [],
        evidence: ["Festival in the park.", "After the quote."].map(
          (quote) => ({
            quote,
            topics: ["description"],
            context: [],
            editionClues: [],
            uncertainty: null,
          }),
        ),
      },
      source.finalUrl,
    );
    await store.saveEvidence(source, bound.evidence);
    const corpus = store.freeze();
    const prepared: PreparedProposals = {
      ...initialDiagnostics(),
      eventName: "Example Festival",
      plan: {
        status: "ready",
        event: { fields: {} },
        previousEdition: null,
        currentOrNextEdition: null,
        unresolved: [],
      },
      location: { slots: {}, support: {}, previousPoints: [], unresolved: [] },
      targets: {
        decision: "targets",
        eventId: null,
        observedEventName: "Example Festival",
        reason: "Official identity",
        evidenceIds: [bound.evidence[0].id],
        event: {},
        previousEdition: null,
        currentOrNextEdition: null,
        checks: [],
        unresolved: [],
      },
      basis: {
        savedEvent: null,
        evidence: [bound.evidence[0]],
        points: [],
        proposals: {},
      },
    };
    const budget = createResearchBudget();
    const execution = await runEditor(
      {
        input: { mode: "add", actor: "test" },
        context: {
          catalog: [],
          terms: [],
          knownLinks: [],
          currentDate: "2026-11-01T00:00:00Z",
        },
        corpus,
        budget,
        config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
        signal: new AbortController().signal,
        deps: {
          client: testDatabase().client,
          generateRole: async (_role, prompt, call) => {
            const input = JSON.parse(prompt);
            expect(input).not.toHaveProperty("decisionShape");
            expect(input.prepared.basis.evidence[0].quote).toBe(
              bound.evidence[0].quote,
            );
            const tool = call.tools!.readEvidence as {
              inputSchema: z.ZodType;
              execute: (input: unknown, context: unknown) => Promise<unknown>;
            };
            expect(
              tool.inputSchema.safeParse({
                ids: [bound.evidence[0].id],
                context: 0,
              }).success,
            ).toBe(false);
            const request = { ids: [bound.evidence[0].id], context: 2000 };
            expect(await tool.execute(request, {})).toEqual([
              {
                id: bound.evidence[0].id,
                sourceId: source.id,
                url: source.finalUrl,
                before: "Before the quote. ",
                after: " After the quote.",
              },
            ]);
            await expect(
              tool.execute({ ids: [bound.evidence[1].id], context: 10 }, {}),
            ).rejects.toThrow("not cited");
            await writeFile(
              source.markdownPath!,
              (await readFile(source.markdownPath!, "utf8")) + "Changed",
            );
            await expect(tool.execute(request, {})).rejects.toThrow(
              "hash mismatch",
            );
            const approve = { decision: "approve", reason: "Supported" };
            return {
              item: approve,
              event: { target: approve, fields: {} },
              previousEdition: null,
              currentOrNextEdition: null,
              unresolved: [],
            };
          },
        },
      },
      prepared,
    );
    expect(execution.status).toBe("success");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

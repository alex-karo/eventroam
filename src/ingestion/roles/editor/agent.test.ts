import { testDatabase } from "@/test/database";
import { fixtureReview } from "@/test/ingestion";
import vocabulary from "@/catalog/taxonomy.json";
import { syncTaxonomy } from "@/catalog/write/sync-taxonomy";
import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindEvidence } from "../../evidence/contracts";
import { createCorpusStorage } from "../../evidence/storage";
import { loadResearchContext } from "../../research/context";
import { createResearchBudget } from "../../runtime/budget";
import type { PreparedProposals } from "../../proposals";
import { initialDiagnostics } from "../../stage";
import { runEditor } from "./agent";

it("shares proposal and repair evidence by ID and checks saved source hashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-editor-context-"));
  try {
    const body = [
      "Before the quote.",
      "Festival in the park.",
      "After the quote.",
      "The festival has a separate cooking programme.",
      "Tickets go on sale tomorrow.",
    ].join("\n");
    const store = createCorpusStorage("editor-test", Date.now(), root);
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
        limitations: [],
        evidence: [
          { quote: "Festival in the park.", topics: ["description"] },
          { quote: "After the quote.", topics: ["description"] },
          {
            quote: "The festival has a separate cooking programme.",
            topics: ["classification"],
          },
          { quote: "Tickets go on sale tomorrow.", topics: ["tickets"] },
        ],
      },
      source.finalUrl,
    );
    await store.saveEvidence(source, bound.evidence);
    source.overview = "Festival page";
    const other = await store.savePage({
      attemptedUrl: "https://example.org/other",
      finalUrl: "https://example.org/other",
      retrievedAt: "2026-11-01T00:00:00Z",
      method: "http",
      status: "ok",
      markdown: "Unrelated Festival page.",
    });
    await store.savePage({
      attemptedUrl: "https://example.org/failed",
      finalUrl: "https://example.org/failed",
      retrievedAt: "2026-11-01T00:00:00Z",
      method: "http",
      status: "failed",
      markdown: "",
    });
    const corpus = store.freeze();
    const prepared: PreparedProposals = {
      ...initialDiagnostics(),
      unresolved: [
        {
          message: "Does the eligibility notice restrict admission?",
          editionKey: "2027",
          field: "tickets",
        },
      ],
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
        previousEdition: null,
        currentOrNextEdition: null,
        checks: [],
        unresolved: [],
      },
      basis: {
        savedEvent: null,
        evidence: [bound.evidence[0]],
        points: [],
      },
    };
    const earlierRepair = {
      path: "event.fields.description",
      owner: "classification" as const,
      target: { eventId: null },
      trigger: "validation" as const,
      note: "Check the description",
      original: null,
    };
    const budget = createResearchBudget();
    const connection = testDatabase();
    const input = { mode: "add", actor: "test" } as const;
    syncTaxonomy(connection, vocabulary, true);
    const context = loadResearchContext(
      connection.client,
      input,
      "2026-11-01T00:00:00Z",
    );
    const execution = await runEditor(
      {
        input,
        context,
        corpus,
        budget,
        config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
        signal: new AbortController().signal,
        deps: {
          client: connection.client,
          generateRole: async (_role, prompt, call) => {
            const input = JSON.parse(prompt);
            expect(input.vocabulary).toEqual(context.terms);
            for (const [slug, phrase] of [
              ["gathering", "participants' contributions"],
              ["openair", "Open Air in the current official festival name"],
              ["mixed-indoor-outdoor", "neither is clearly primary"],
              ["wine", "for the selected Edition"],
              ["beer", "for the selected Edition"],
            ]) {
              expect(input.vocabulary).toContainEqual(
                expect.objectContaining({
                  slug,
                  id: expect.any(String),
                  description: expect.stringContaining(phrase),
                }),
              );
            }
            expect(
              input.vocabulary.find(
                ({ slug }: { slug: string }) => slug === "jazz",
              ),
            ).not.toHaveProperty("description");
            expect(input.currentDate).toBe("2026-11-01T00:00:00Z");
            expect(input).not.toHaveProperty("decisionShape");
            expect(input.prepared.unresolved).toEqual(prepared.unresolved);
            expect(input.prepared.identity.evidenceIds).toEqual([
              bound.evidence[0].id,
            ]);
            expect(input.prepared.basis).toEqual({
              savedEvent: null,
              points: [],
            });
            expect(input.evidence).toEqual(
              bound.evidence
                .slice(0, 3)
                .map(({ id, sourceId, quote, topics }) => ({
                  id,
                  sourceId,
                  quote,
                  topics,
                })),
            );
            expect(input.repairs).toEqual([
              { ...earlierRepair, evidenceIds: [bound.evidence[1].id] },
              { ...earlierRepair, evidenceIds: [bound.evidence[0].id] },
            ]);
            expect(Object.keys(call.tools!)).toEqual(["mastra_workspace_grep"]);
            expect(input.sourceFiles).toEqual([
              {
                sourceId: source.id,
                path: "s1.md",
                url: "https://example.org/",
                overview: "Festival page",
              },
              {
                sourceId: other.id,
                path: "s2.md",
                url: "https://example.org/other",
                overview: null,
              },
            ]);
            const tool = call.tools!.mastra_workspace_grep as {
              execute: (input: unknown, context: unknown) => Promise<string>;
            };
            const request = {
              pattern: "Festival",
              path: "s1.md",
              contextLines: 1,
              maxCount: 10,
              caseSensitive: true,
              includeHidden: false,
            };
            const output = await tool.execute(request, {});
            expect(output).toContain("Festival in the park.");
            expect(output).toContain("Before the quote.");
            expect(output).toContain("After the quote.");
            expect(
              await tool.execute({ ...request, path: "s2.md" }, {}),
            ).toContain("Unrelated Festival page.");
            for (const path of [
              ".",
              "../outside.md",
              "s3.md",
              "s1.evidence.json",
            ]) {
              await expect(
                tool.execute({ ...request, path }, {}),
              ).rejects.toThrow("not saved in this run");
            }
            await writeFile(
              source.markdownPath!,
              (await readFile(source.markdownPath!, "utf8")) + "Changed",
            );
            await expect(tool.execute(request, {})).rejects.toThrow(
              "hash mismatch",
            );
            await writeFile(
              other.markdownPath!,
              (await readFile(other.markdownPath!, "utf8")) + "Changed",
            );
            await expect(
              tool.execute({ ...request, path: "s2.md" }, {}),
            ).rejects.toThrow("hash mismatch");
            return fixtureReview(input);
          },
        },
      },
      prepared,
      {
        reviewPaths: ["item", "event.target"].map((path) => ({
          path,
          allowed: ["approve", "reject"],
        })),
        missingGroups: ["event.fields.description"],
      },
      [
        { ...earlierRepair, evidence: [bound.evidence[1]] },
        { ...earlierRepair, evidence: [bound.evidence[0]] },
      ],
    );
    expect(execution.status).toBe("success");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { testDatabase } from "@/test/database";
import { approveFixtureReview } from "@/test/ingestion";
import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindEvidence } from "../../evidence/contracts";
import { createCorpusStorage } from "../../evidence/storage";
import { createResearchBudget } from "../../runtime/budget";
import type { PreparedProposals } from "../../proposals";
import { initialDiagnostics } from "../../stage";
import { runEditor } from "./agent";

it("uses native Mastra grep with all saved source files and hash checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-editor-context-"));
  try {
    const body = "Before the quote.\nFestival in the park.\nAfter the quote.";
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
    const budget = createResearchBudget();
    const execution = await runEditor(
      {
        input: { mode: "add", actor: "test" },
        context: {
          catalog: [],
          terms: [
            { id: "opaque-id", facet: "genre", slug: "jazz", parentId: null },
          ],
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
            expect(input.vocabulary).toEqual([
              { id: "opaque-id", facet: "genre", slug: "jazz", parentId: null },
            ]);
            expect(input.currentDate).toBe("2026-11-01T00:00:00Z");
            expect(input).not.toHaveProperty("decisionShape");
            expect(input.prepared.unresolved).toEqual(prepared.unresolved);
            expect(input.prepared.basis.evidence[0].quote).toBe(
              bound.evidence[0].quote,
            );
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
            return approveFixtureReview(input.reviewPaths);
          },
        },
      },
      prepared,
      ["item", "event.target"].map((path) => ({
        path,
        required: true,
        allowed: ["approve", "reject"],
      })),
      [],
    );
    expect(execution.status).toBe("success");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { expect, it } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { loadResearchContext } from "../../research/context";
import { bindEvidence } from "../../evidence/contracts";
import { createResearchBudget } from "../../runtime/budget";
import { runGeneral } from "./agent";

it.each(["add", "full", "current"] as const)(
  "keeps General identity and saved facts without other role instructions (%s)",
  async (mode) => {
    const db = testDatabase();
    const fixtures = testFixtures(db.client);
    const event = fixtures.event({
      aliases: ["Other festival name"],
      description: "Saved description",
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
        ? { mode: "add" as const, input: event.canonicalName, actor: "test" }
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
      corpus: {
        version: "fixture",
        sources: [
          {
            id: "s1",
            attemptedUrl: "https://example.org/",
            finalUrl: "https://example.org/",
            retrievedAt: context.currentDate,
            method: "http",
            status: "ok",
            processing: "complete",
            limitations: [],
          },
        ],
        evidence: bindEvidence(
          "s1",
          "The festival takes place in Ireland.",
          {
            limitations: [],
            evidence: [
              {
                quote: "The festival takes place in Ireland.",
                topics: ["location"],
              },
            ],
          },
          "https://example.org/",
        ).evidence,
      },
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
          expect(data.corpus.evidence).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                quote: "The festival takes place in Ireland.",
                topics: ["location"],
              }),
            ]),
          );
          expect(data.assignment.permissions.eventFields).toBe(
            mode !== "current",
          );
          expect(data.assignedChecks).toContain("currentDates");
          expect(data.assignedChecks).not.toContain("currentTickets");
          expect(data.assignedChecks).not.toContain("description");
          expect(data.candidates[0]).not.toHaveProperty("description");
          expect(data.candidates[0]).toMatchObject({
            id: event.id,
            version: event.version,
            aliases: event.aliases,
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

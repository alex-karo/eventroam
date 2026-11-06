import { afterEach, expect, test, vi } from "vitest";
import { createTestDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import { studioIngestionInputSchema } from "./invocation";
import {
  fixtureDependencies,
  fixtureTargets,
  fixtureLocationPlan,
  fixtureChecks,
  set,
  runFixtureResearch as runCatalogResearch,
  createFixtureIngestionWorkflow,
} from "@/test/ingestion";
import type { GenerateRole } from "./roles/invoke";
const reason = "Inspected official source confirms this fact";
function fixture(countryCode: string | null = "IE") {
  const { client } = createTestDatabase();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Fixture Fest", summary: "Saved" });
  const old = fx.edition(event, {
    editionKey: "source-row",
    editionYear: 2026,
    startsOn: "2026-06-01",
    endsOn: "2026-06-03",
    timeZone: "America/Los_Angeles",
    countryCode,
  });
  fx.eventLink(event, {
    url: "https://fixture.example/festival",
    kind: "official_site",
  });
  const general = fixtureTargets(event.id);
  general.observedEventName = "Fixture Fest";
  general.currentOrNextEdition = null;
  const defaults = fixtureDependencies();
  const readPage = vi.fn(defaults.readPage);
  const generateRole = vi.fn(defaults.generateRole);
  const deps = {
    ...defaults,
    client,
    readPage,
    generateRole,
    generateRoles: { general: async () => general },
    todayUtc: "2026-10-11",
  };
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "catalog-research",
    dryRun: false,
  };
  return { client, fx, event, old, deps, input, general };
}
function noWrites(f: ReturnType<typeof fixture>) {
  expect(f.client.prepare("SELECT * FROM catalog_changes").all()).toEqual([]);
  expect(f.client.prepare("SELECT * FROM operation_receipts").all()).toEqual(
    [],
  );
}
afterEach(() => vi.restoreAllMocks());
test.each(["full", "current"] as const)(
  "%s supplies the fixed date, permissions and saved context to General",
  async (scope) => {
    const f = fixture();
    f.general.currentOrNextEdition = fixtureTargets().currentOrNextEdition;
    const general: GenerateRole = async (_role, raw) => {
      const prompt = JSON.parse(raw);
      expect(prompt.assignment.currentDate).toBe("2026-10-11T12:00:00.000Z");
      expect(prompt.assignment.permissions.eventFields).toBe(scope === "full");
      expect(prompt.candidates[0].editions[0]).toMatchObject({
        editionKey: "source-row",
        countryCode: "IE",
        startsOn: "2026-06-01",
        endsOn: "2026-06-03",
        timeZone: "America/Los_Angeles",
      });
      return f.general;
    };
    const result = await runCatalogResearch(
      { ...f.input, scope, dryRun: true },
      { ...f.deps, generateRoles: { general } },
    );
    expect(result).toMatchObject({
      researchStatus: "success",
      scope,
      currentDate: "2026-10-11T12:00:00.000Z",
      workload: { savedEditions: 1, returnedEditions: 1 },
    });
    expect(readResearchEvent(f.client, f.event.id)!.summary).toBe("Saved");
    noWrites(f);
  },
);
test.each(["AU", "GB", null])(
  "Location country %s conflicts with the saved country before Editor",
  async (countryCode) => {
    const f = fixture();
    f.general.currentOrNextEdition = fixtureTargets().currentOrNextEdition;
    const before = readResearchEvent(f.client, f.event.id);
    const editor = vi.fn();
    const result = await runCatalogResearch(f.input, {
      ...f.deps,
      generateRoles: { ...f.deps.generateRoles, editor },
      generateLocation: async (raw) => {
        const plan = fixtureLocationPlan(JSON.parse(raw));
        if (plan.decision.status !== "ready") {
          throw new Error("Expected ready fixture");
        }
        plan.decision.currentOrNextEdition!.fields.countryCode =
          countryCode === null
            ? { action: "clear", reason }
            : { action: "set", value: countryCode, reason };
        plan.decision.currentOrNextEdition!.evidenceIds = ["s1-e1"];
        return plan;
      },
    });
    expect(result.outcome).toBe("failed");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "country_conflict" }),
    );
    expect(editor).not.toHaveBeenCalled();
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
    noWrites(f);
  },
);
test("a known historical sibling constrains an unknown selected country", async () => {
  const f = fixture();
  f.fx.edition(f.event, { editionKey: "unknown", countryCode: null });
  f.general.currentOrNextEdition = {
    ...fixtureTargets().currentOrNextEdition!,
    editionKey: "unknown",
  };
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    {
      ...f.deps,
      generateLocation: async (raw) => {
        const plan = fixtureLocationPlan(JSON.parse(raw));
        if (plan.decision.status === "ready") {
          plan.decision.currentOrNextEdition!.fields.countryCode = {
            action: "set",
            value: "AU",
            reason,
          };
          plan.decision.currentOrNextEdition!.evidenceIds = ["s1-e1"];
        }
        return plan;
      },
    },
  );
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "country_conflict" }),
  );
  noWrites(f);
});
test("conflicting saved countries stop before external work, including an unchanged country proposal", async () => {
  const f = fixture();
  f.fx.edition(f.event, { editionKey: "sibling", countryCode: "AU" });
  const result = await runCatalogResearch(f.input, f.deps);
  expect(result.errors[0].code).toBe("country_baseline_conflict");
  expect(f.deps.readPage).not.toHaveBeenCalled();
  expect(f.deps.generateRole).not.toHaveBeenCalled();
  noWrites(f);
});
test.each(["country", "sibling", "remove"] as const)(
  "concurrent baseline %s rolls back the entire write",
  async (mutation) => {
    const f = fixture();
    f.general.event.summary = set("Researched");
    const result = await runCatalogResearch(f.input, {
      ...f.deps,
      generateRoles: {
        general: async () => {
          if (mutation === "country") {
            f.client
              .prepare("UPDATE editions SET country_code='GB' WHERE id=?")
              .run(f.old.id);
          }
          if (mutation === "sibling") {
            f.fx.edition(f.event, { countryCode: "IE" });
          }
          if (mutation === "remove") {
            f.client.prepare("DELETE FROM editions WHERE id=?").run(f.old.id);
          }
          return f.general;
        },
      },
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "write_failed" }),
    );
    expect(result.receipts).toEqual([]);
    expect(readResearchEvent(f.client, f.event.id)!.summary).toBe("Saved");
    noWrites(f);
  },
);
test.each(["event", "previous", "completed"] as const)(
  "current rejects the out-of-scope %s proposal",
  async (kind) => {
    const f = fixture();
    if (kind === "event") {
      f.general.event.summary = set("Forbidden");
    }
    if (kind === "previous") {
      f.general.previousEdition = {
        editionKey: "source-row",
        fields: {},
        reason,
        evidenceIds: ["s1-e1"],
      };
    }
    if (kind === "completed") {
      f.general.currentOrNextEdition = {
        editionKey: "source-row",
        fields: {},
        reason,
        evidenceIds: ["s1-e1"],
      };
    }
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      f.deps,
    );
    expect(result.outcome).toBe("failed");
    expect(result.operations).toEqual([]);
    noWrites(f);
  },
);
test("Studio rejects a current-scope Event link proposal", async () => {
  const f = fixture();
  const links = {
    event: { website: set("https://fixture.example/festival"), socials: {} },
    currentOrNextEdition: null,
    checks: [],
    unresolved: [],
    omitted: [],
  };
  const deps = {
    ...f.deps,
    generateRoles: { ...f.deps.generateRoles, links: async () => links },
  };
  const workflow = createFixtureIngestionWorkflow(async () => ({ deps }));
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: studioIngestionInputSchema.parse({
      mode: "refresh",
      input: { eventId: f.event.id, scope: "current" },
    }),
    outputOptions: { includeState: true },
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error("Unexpected workflow status");
  }
  const report = result.state!.data!.report!;
  expect(report.outcome).toBe("failed");
  expect(report.operations).toEqual([]);
  noWrites(f);
});
test("full selects both Editions with more than twenty saved Editions", async () => {
  const f = fixture();
  for (let n = 0; n < 20; n++) {
    f.fx.edition(f.event, { editionKey: `saved-${n}`, countryCode: "IE" });
  }
  f.general.previousEdition = {
    editionKey: "past",
    fields: { year: set(2025) },
    reason,
    evidenceIds: ["s1-e1"],
  };
  f.general.currentOrNextEdition = fixtureTargets().currentOrNextEdition;
  const result = await runCatalogResearch(f.input, f.deps);
  expect(result.errors).toEqual([]);
  expect(result.workload).toEqual({ savedEditions: 21, returnedEditions: 2 });
  expect(readResearchEvent(f.client, f.event.id)!.editions).toHaveLength(23);
});
test.each(["verified", "unfinished"] as const)(
  "no announced Edition preserves saved data with %s checks",
  async (finding) => {
    const f = fixture();
    const before = readResearchEvent(f.client, f.event.id);
    f.general.checks = fixtureChecks(
      ["identity", "currentAnnouncement", "currentDates"],
      finding,
    );
    if (finding === "unfinished") {
      f.general.unresolved = [
        { message: "Announcement order remains unknown" },
      ];
    }
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      f.deps,
    );
    expect(result).toMatchObject({
      outcome: "unchanged",
      researchStatus: finding === "verified" ? "success" : "partial",
      editorStatus: "success",
      operations: [],
    });
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
    noWrites(f);
  },
);
test.each(["previousCompletedEdition", "latestCompletedEdition"])(
  "current status ignores an unassigned unfinished %s check",
  async (check) => {
    const f = fixture();
    const before = readResearchEvent(f.client, f.event.id);
    const question = { message: "Which historical Edition took place?" };
    f.general.checks = [
      ...fixtureChecks(["identity", "currentAnnouncement", "currentDates"]),
      ...fixtureChecks([check], "unfinished"),
    ];
    f.general.unresolved = [question];
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      f.deps,
    );
    expect(result).toMatchObject({
      outcome: "unchanged",
      researchStatus: "success",
      operations: [],
    });
    expect(result.unresolved).toContainEqual(question);
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
    noWrites(f);
  },
);
test("an identity contradiction stops before Editor", async () => {
  const f = fixture();
  const editor = vi.fn();
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    {
      ...f.deps,
      generateRoles: {
        general: async () => ({
          decision: "uncertain",
          reason: "Saved site belongs to a namesake; run a full refresh",
          unresolved: [{ field: "identity", message: "Confirm the Event" }],
        }),
        editor,
      },
    },
  );
  expect(result.outcome).toBe("failed");
  expect(editor).not.toHaveBeenCalled();
  noWrites(f);
});
test.each([true, false])(
  "new Edition taxonomy requires an explicit Classification response (%s)",
  async (reuse) => {
    const f = fixture();
    const terms = f.fx.festivalTerms();
    terms.forEach((term) => f.fx.assignTerm(f.old, term));
    const before = readResearchEvent(f.client, f.event.id)!;
    f.general.currentOrNextEdition = fixtureTargets().currentOrNextEdition;
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      {
        ...f.deps,
        generateRoles: {
          ...f.deps.generateRoles,
          classification: async () => ({
            previousEdition: null,
            currentOrNextEdition: reuse
              ? {
                  classification: {
                    ...set(terms.map((term) => term.id)),
                    reuseFrom: { editionKey: "source-row", reason },
                  },
                }
              : {},
            checks: [],
            unresolved: [],
          }),
        },
      },
    );
    expect(result.errors).toEqual([]);
    const saved = readResearchEvent(f.client, f.event.id)!;
    const created = saved.editions.find((e) => e.editionKey === "2027")!;
    expect(created.terms.map((term) => term.id).sort()).toEqual(
      reuse ? terms.map((term) => term.id).sort() : [],
    );
    expect(saved.editions.find((e) => e.id === f.old.id)).toEqual(
      before.editions[0],
    );
    expect(saved.summary).toBe("Saved");
  },
);

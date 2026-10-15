import { afterEach, expect, test, vi } from "vitest";
import { createTestDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import { studioIngestionInputSchema } from "./workflow";
import type { ResearchCandidate } from "./research/contracts";
import type { ResearchDependencies } from "./contracts";
import {
  prepareEditorialFixture,
  runFixtureResearch as runCatalogResearch,
  createFixtureIngestionWorkflow as createCatalogIngestionWorkflow,
} from "@/test/ingestion";
const reason = "Inspected official source confirms this fact";
const url = "https://fixture.example/festival";
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
  fx.eventLink(event, { url, kind: "official_site" });
  const read = vi.fn<NonNullable<ResearchDependencies["readPage"]>>(
    async (requested, options) => {
      options.budget.consumePage();
      return {
        attemptedUrl: requested,
        finalUrl: requested,
        retrievedAt: "2026-10-11T12:00:00Z",
        method: "http",
        outcome: "ok",
        completeness: "full",
        markdown: "Fixture Fest 2027",
        links: [],
      };
    },
  );
  const deps = { client, readPage: read, todayUtc: "2026-10-11" };
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "catalog-research",
    dryRun: false,
  };
  const proposal: ResearchCandidate = {
    status: "success",
    data: {
      eventName: "Fixture Fest",
      summary: { value: "Researched", reason },
      sources: [{ url, information: reason }],
      links: { socials: {} },
      editions: [],
    },
    errors: [],
    unresolved: [],
  };
  return { client, fx, event, old, read, deps, input, proposal };
}
function noWrites(client: ReturnType<typeof fixture>["client"]) {
  expect(client.prepare("SELECT * FROM catalog_changes").all()).toEqual([]);
  expect(client.prepare("SELECT * FROM operation_receipts").all()).toEqual([]);
}
afterEach(() => vi.restoreAllMocks());
test.each(["full", "current"] as const)(
  "%s passes scope and the catalog snapshot without a separate refresh object",
  async (scope) => {
    const f = fixture();
    f.proposal.data!.editions = [
      {
        key: "new-2027",
        year: { value: 2027, reason },
        countryCode: { value: "IE", reason },
        links: {},
      },
    ];
    const result = await runCatalogResearch(
      { ...f.input, scope, dryRun: true },
      {
        ...f.deps,
        generateCandidate: async (prompt) => {
          const parsed = JSON.parse(prompt);
          expect(parsed).not.toHaveProperty("refresh");
          expect(parsed).not.toHaveProperty("catalog");
          expect(parsed.scope).toBe(scope);
          expect(parsed.currentDate).toBe("2026-10-11T12:00:00.000Z");
          expect(parsed.compact.editions[0]).toMatchObject({
            editionKey: "source-row",
            countryCode: "IE",
            startsOn: "2026-06-01",
            endsOn: "2026-06-03",
            timeZone: "America/Los_Angeles",
          });
          return f.proposal;
        },
      },
    );
    expect(result.researchStatus).toBe("success");
    expect(result.modelResponse!.object).toEqual(f.proposal);
    expect(result.scope).toBe(scope);
    expect(result.currentDate).toBe("2026-10-11T12:00:00.000Z");
    expect(result).not.toHaveProperty("refresh");
    expect(result).not.toHaveProperty("verification");
    expect(result.workload).toEqual({
      savedEditions: 1,
      returnedEditions: 1,
    });
    expect(readResearchEvent(f.client, f.event.id)!.summary).toBe("Saved");
    noWrites(f.client);
    const stored = f.client
      .prepare(
        "SELECT report_json,status,input_json FROM ingestion_runs WHERE id=?",
      )
      .get(result.runId) as {
      report_json: string;
      status: string;
      input_json: string;
    };
    expect(stored.status).toBe("completed");
    expect(JSON.parse(stored.report_json)).toEqual(result);
    expect(JSON.parse(stored.input_json).scope).toBe(scope);
  },
);
test.each([
  ["new-2027", "AU"],
  ["new-2027", "GB"],
  ["new-2027", null],
  ["source-row", "GB"],
] as const)(
  "Edition %s country %s conflict blocks all writes and editor generation",
  async (editionKey, country) => {
    const f = fixture();
    const before = readResearchEvent(f.client, f.event.id);
    const generateEditor = vi.fn();
    f.proposal.data!.links.website = "https://correct.fixture.example/";
    f.proposal.data!.editions = [
      {
        key: editionKey,
        countryCode: { value: country, reason },
        links: { tickets: "https://tickets.fixture.example/" },
      },
    ];
    const result = await runCatalogResearch(f.input, {
      ...f.deps,
      generateEditor,
      generateCandidate: async () => {
        return f.proposal;
      },
    });
    expect(result).toMatchObject({
      outcome: "failed",
      researchStatus: "success",
      editorStatus: "not_run",
      changes: [],
      operations: [],
      receipts: [],
      modelResponse: { object: f.proposal },
    });
    expect(result.sourceSummaries).toEqual(f.proposal.data!.sources);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "country_conflict",
        stage: "validation",
        editionKey,
        field: "countryCode",
      }),
    );
    expect(generateEditor).not.toHaveBeenCalled();
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
    noWrites(f.client);
    expect(f.client.prepare("SELECT status FROM ingestion_runs").get()).toEqual(
      { status: "failed" },
    );
  },
);
test("unknown selected country is constrained by a known historical sibling", async () => {
  const f = fixture();
  f.fx.edition(f.event, { editionKey: "unknown", countryCode: null });
  f.proposal.data!.editions = [
    { key: "unknown", countryCode: { value: "AU", reason }, links: {} },
  ];
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    {
      ...f.deps,
      generateCandidate: async () => {
        return f.proposal;
      },
    },
  );
  expect(result.errors[0].code).toBe("country_conflict");
  expect(result.workload.returnedEditions).toBe(1);
  noWrites(f.client);
});
test("conflicting saved countries and oversized history fail before any external calls", async () => {
  for (const oversized of [false, true]) {
    const f = fixture();
    if (oversized) {
      for (let n = 0; n < 20; n++) {
        f.fx.edition(f.event, {
          editionKey: `history-${n}`,
          countryCode: "IE",
        });
      }
    } else {
      f.fx.edition(f.event, { editionKey: "sibling", countryCode: "AU" });
    }
    const generate = vi.fn();
    const result = await runCatalogResearch(f.input, {
      ...f.deps,
      generateCandidate: generate,
    });
    expect(f.read).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(result.workload.returnedEditions).toBe(0);
    noWrites(f.client);
    expect(result.errors[0].code).toBe(
      oversized ? "limit_reached" : "country_baseline_conflict",
    );
    expect(result).not.toHaveProperty("refresh");
    expect(result).not.toHaveProperty("verification");
    expect(result.workload.savedEditions).toBe(oversized ? 21 : 2);
  }
});
test.each(["country", "sibling", "remove"] as const)(
  "concurrent baseline %s aborts the whole atomic apply",
  async (mutation) => {
    const f = fixture();
    const result = await runCatalogResearch(f.input, {
      ...f.deps,
      generateCandidate: async () => {
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
        return f.proposal;
      },
    });
    expect(result).toMatchObject({
      outcome: "failed",
      researchStatus: "success",
      receipts: [],
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "write_failed" }),
    );
    expect(readResearchEvent(f.client, f.event.id)!.summary).toBe("Saved");
    noWrites(f.client);
  },
);
test("current updates the returned Edition only; full permits a historical Edition update", async () => {
  const f = fixture("PT");
  const next = f.fx.edition(f.event, {
    editionKey: "summer-2027",
    countryCode: "PT",
    endsOn: "2027-07-03",
  });
  f.proposal.data!.editions = [
    {
      key: "summer-2027",
      venueName: { value: "Correct venue", reason },
      links: {},
    },
  ];
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    {
      ...f.deps,
      generateCandidate: async () => {
        return f.proposal;
      },
    },
  );
  expect(result.outcome).toBe("updated");
  const saved = readResearchEvent(f.client, f.event.id)!;
  expect(saved.editions.find((e) => e.id === f.old.id)!.version).toBe(1);
  expect(saved.editions.find((e) => e.id === next.id)!.venueName).toBe(
    "Correct venue",
  );
  const full = await runCatalogResearch(f.input, {
    ...f.deps,
    generateCandidate: async () => {
      return {
        ...f.proposal,
        data: {
          ...f.proposal.data!,
          editions: [
            {
              key: "source-row",
              year: { value: 2026, reason },
              venueName: { value: "Historic venue", reason },
              links: {},
            },
          ],
        },
      };
    },
  });
  expect(full.outcome).toBe("updated");
  expect(full.workload.savedEditions).toBe(2);
  expect(
    readResearchEvent(f.client, f.event.id)!.editions.find(
      (e) => e.id === f.old.id,
    )!.venueName,
  ).toBe("Historic venue");
});
test("CLI and Studio current previews process a supplied replacement website equivalently", async () => {
  const f = fixture();
  f.proposal.data!.links.website = "https://correct.fixture.example/";
  const deps = {
    ...f.deps,
    generateCandidate: async (
      _p: string,
      c: Parameters<NonNullable<ResearchDependencies["generateCandidate"]>>[1],
    ) => {
      await c.readPage("https://correct.fixture.example/");
      return f.proposal;
    },
  };
  const cli = await runCatalogResearch(
    { ...f.input, scope: "current", dryRun: true },
    deps,
  );
  const workflow = createCatalogIngestionWorkflow(async () => ({ deps }));
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: studioIngestionInputSchema.parse({
      mode: "refresh",
      eventId: f.event.id,
      scope: "current",
    }),
    outputOptions: { includeState: true },
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error("Unexpected workflow status");
  }
  expect(result.result).toMatchObject({
    scope: "current",
    savedEditionCount: 1,
    returnedEditionCount: 0,
  });
  expect(result.state!.data!.context).not.toHaveProperty("refresh");
  expect(result.state!.data!.context!.currentDate).toBe(cli.currentDate);
  expect(result.state!.data!.context!.catalog[0].editions).toHaveLength(
    cli.workload.savedEditions,
  );
  expect(result.state!.data!.report!.operations.map((o) => o.kind)).toEqual(
    cli.operations.map((o) => o.kind),
  );
  noWrites(f.client);
  for (const report of [cli, result.state!.data!.report!]) {
    expect(report.sources).toContainEqual(
      expect.objectContaining({ finalUrl: "https://correct.fixture.example/" }),
    );
    expect(report.operations).toContainEqual(
      expect.objectContaining({
        kind: "replaceLinks",
        links: expect.arrayContaining([
          expect.objectContaining({
            kind: "official_site",
            url: "https://correct.fixture.example/",
          }),
        ]),
      }),
    );
  }
});
test("unchanged country facts cannot evade guards through operation no-ops", () => {
  const f = fixture();
  f.fx.edition(f.event, { editionKey: "sibling", countryCode: "AU" });
  const saved = readResearchEvent(f.client, f.event.id)!;
  f.proposal.data!.editions = [
    { key: "source-row", countryCode: { value: "IE", reason }, links: {} },
  ];
  const prepared = prepareEditorialFixture(f.proposal, [saved], f.input, []);
  expect(prepared.operations).toEqual([]);
  expect(prepared.errors[0].code).toBe("country_baseline_conflict");
});

test.each(["current", "full"] as const)(
  "%s rejects too many proposed targets before any operations",
  async (scope) => {
    const f = fixture();
    f.proposal.data!.editions = [
      { key: "new-one", year: { value: 2027, reason }, links: {} },
      { key: "new-two", year: { value: 2028, reason }, links: {} },
    ];
    const result = await runCatalogResearch(
      { ...f.input, scope },
      { ...f.deps, generateCandidate: async () => f.proposal },
    );
    expect(result.errors[0].code).toBe("invalid_candidate");
    expect(result.operations).toEqual([]);
    expect(result.modelResponse!.object).toEqual(f.proposal);
    expect(readResearchEvent(f.client, f.event.id)!.summary).toBe("Saved");
    noWrites(f.client);
  },
);
test("full rejects a new Edition when the complete saved/new union exceeds 20", async () => {
  const f = fixture();
  for (let n = 0; n < 19; n++) {
    f.fx.edition(f.event, { editionKey: `saved-${n}`, countryCode: "IE" });
  }
  f.proposal.data!.editions = [
    { key: "new-one", year: { value: 2027, reason }, links: {} },
  ];
  const generate = vi.fn(async () => f.proposal);
  const result = await runCatalogResearch(f.input, {
    ...f.deps,
    generateCandidate: generate,
  });
  expect(generate).toHaveBeenCalledOnce();
  expect(result.errors[0].code).toBe("limit_reached");
  expect(result.outcome).toBe("failed");
  expect(result.researchStatus).toBe("success");
  expect(result.editorStatus).toBe("not_run");
  expect(result.workload.savedEditions).toBe(20);
  expect(result.operations).toEqual([]);
  noWrites(f.client);
});
test("current retains all saved context without imposing a full-history limit or temporal host gate", async () => {
  const f = fixture();
  for (let n = 0; n < 20; n++) {
    f.fx.edition(f.event, { editionKey: `saved-${n}`, countryCode: "IE" });
  }
  f.proposal.data!.editions = [
    {
      key: "source-row",
      venueName: { value: "Inspected venue", reason },
      links: {},
    },
  ];
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    { ...f.deps, generateCandidate: async () => f.proposal },
  );
  expect(result.outcome).toBe("updated");
  expect(result.workload.savedEditions).toBe(21);
  expect(result.workload.returnedEditions).toBe(1);
  expect(result).not.toHaveProperty("refresh");
});

test.each(["success", "partial"] as const)(
  "current %s with no selected Edition preserves catalog and reports inspected findings",
  async (status) => {
    const f = fixture();
    delete f.proposal.data!.summary;
    f.proposal.status = status;
    f.proposal.data!.sources[0].information =
      status === "success"
        ? "Official target website: no ongoing or future Edition announced on inspected pages"
        : "Official target website: two future announcements have unresolved ordering";
    f.proposal.unresolved =
      status === "partial"
        ? [
            {
              message:
                "Which announced weekend starts first? Dates remain unknown.",
            },
          ]
        : [];
    const before = readResearchEvent(f.client, f.event.id);
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      {
        ...f.deps,
        generateCandidate: async () => f.proposal,
      },
    );
    expect(result).toMatchObject({
      researchStatus: status,
      editorStatus: "success",
      outcome: "unchanged",
      operations: [],
      changes: [],
      modelResponse: { object: f.proposal },
    });
    expect(result.sourceSummaries).toEqual(f.proposal.data!.sources);
    expect(result.unresolved).toEqual(f.proposal.unresolved);
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
    noWrites(f.client);
  },
);

test("current identity contradiction stops before editing and preserves the catalog", async () => {
  const f = fixture();
  const before = readResearchEvent(f.client, f.event.id);
  const candidate = {
    status: "failed",
    data: null,
    errors: [],
    unresolved: [
      {
        field: "identity",
        message:
          "Saved site belongs to a namesake in another country; run full to recover the correct website.",
      },
    ],
  };
  const result = await runCatalogResearch(
    { ...f.input, scope: "current" },
    {
      ...f.deps,
      generateCandidate: async () => candidate,
      generateEditor: async () => {
        throw new Error("Failed research must not reach editing");
      },
    },
  );
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "failed",
    editorStatus: "not_run",
    operations: [],
    changes: [],
    modelResponse: { object: candidate },
  });
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
  noWrites(f.client);
});

test.each([true, false])(
  "new current Edition inherits taxonomy only from an explicit finding (%s)",
  async (reuse) => {
    const f = fixture();
    const terms = f.fx.festivalTerms();
    for (const term of terms) {
      f.fx.assignTerm(f.old, term);
    }
    const before = readResearchEvent(f.client, f.event.id)!;
    delete f.proposal.data!.summary;
    f.proposal.data!.editions = [
      {
        key: "new-2027",
        year: { value: 2027, reason },
        countryCode: { value: "IE", reason },
        dates: {
          value: {
            startsOn: "2027-06-01",
            endsOn: "2027-06-03",
            state: "confirmed",
          },
          reason,
        },
        venueName: { value: "Festival grounds", reason },
        ...(reuse
          ? {
              classification: {
                value: terms.map((t) => t.id),
                reason:
                  "Reuse source-row: inspected 2027 announcement confirms the same outdoor music programme.",
              },
            }
          : {}),
        links: {},
      },
    ];
    const result = await runCatalogResearch(
      { ...f.input, scope: "current" },
      { ...f.deps, generateCandidate: async () => f.proposal },
    );
    expect(result.errors).toEqual([]);
    const saved = readResearchEvent(f.client, f.event.id)!;
    const created = saved.editions.find((e) => e.editionKey === "new-2027")!;
    expect(created.terms.map((t) => t.id).sort()).toEqual(
      reuse ? terms.map((t) => t.id).sort() : [],
    );
    expect(created.publicationState).toBe(reuse ? "published" : "draft");
    expect(saved.editions.find((e) => e.id === f.old.id)).toEqual(
      before.editions[0],
    );
    expect(saved.summary).toBe("Saved");
    expect(result.modelResponse!.object).toEqual(f.proposal);
  },
);

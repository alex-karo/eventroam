import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { readResearchCatalog } from "@/catalog/read/research";
import {
  fixtureDependencies,
  fixtureTargets,
  fixtureRoleGenerator,
  approveFixtureReview,
  set,
  clear,
  runFixtureResearch,
} from "@/test/ingestion";
import type { GenerateRole } from "./invoke";
const input = {
  mode: "add" as const,
  name: "Example Fest",
  actor: "test",
  dryRun: false,
};
afterEach(() => vi.restoreAllMocks());
test.each(["malformed", "throw", "reject"] as const)(
  "Editor %s retains General output and writes nothing",
  async (failure) => {
    const { client } = testDatabase();
    const general = fixtureTargets();
    general.event.summary = set("Supported summary");
    let response: unknown;
    const editor: GenerateRole = async (_role, raw) => {
      if (failure === "throw") {
        throw new Error("PRIVATE_PROVIDER_DATA");
      }
      if (failure === "malformed") {
        return (response = {
          item: { decision: "approve" },
          replacement: "Forbidden",
        });
      }
      response = {
        ...(approveFixtureReview(JSON.parse(raw).prepared) as object),
        item: { decision: "reject", reason: "Identity is not supported" },
        unresolved: [{ message: "Confirm the organizer" }],
      };
      return response;
    };
    const result = await runFixtureResearch(input, {
      client,
      ...fixtureDependencies({ general, editor }),
    });
    expect(result.outcome).toBe("failed");
    expect(result.researchStatus).toBe("success");
    expect(result.modelResponse?.object).toEqual(general);
    if (failure !== "throw") {
      expect(result.editorResponse?.object).toEqual(response);
    }
    expect(result.operations).toEqual([]);
    expect(readResearchCatalog(client)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_DATA");
  },
);
test("Editor rejects one field without replacing its value or changing General output", async () => {
  const { client } = testDatabase();
  const general = fixtureTargets();
  general.event.summary = set("Supported summary");
  const original = structuredClone(general);
  const result = await runFixtureResearch(input, {
    client,
    ...fixtureDependencies({
      general,
      editor: async (_role: unknown, raw: string) => {
        const review = approveFixtureReview(JSON.parse(raw).prepared) as {
          event: { fields: { summary: unknown } };
        };
        review.event.fields.summary = {
          decision: "reject",
          reason: "Summary evidence is incomplete",
        };
        return review;
      },
    }),
  });
  expect(result.errors).toEqual([]);
  expect(general).toEqual(original);
  expect(readResearchCatalog(client)[0].summary).toBeNull();
  expect(readResearchCatalog(client)[0].editions).toHaveLength(1);
});
test("all interpretation roles receive the same date and Editor receives fixed proposals", async () => {
  const { client } = testDatabase();
  const dates: string[] = [];
  const roles: string[] = [];
  const defaults = fixtureRoleGenerator();
  const generateRole: GenerateRole = async (role, raw, call) => {
    const prompt = JSON.parse(raw);
    roles.push(role);
    if (role === "general" || role === "editor") {
      dates.push(prompt.assignment?.currentDate ?? prompt.currentDate);
    }
    if (role === "editor") {
      expect(prompt.prepared).not.toHaveProperty("targets");
      expect(prompt.prepared.plan.currentOrNextEdition.editionKey).toBe("2027");
      expect(prompt.prepared.basis.evidence).not.toEqual([]);
    }
    return defaults(role, raw, call);
  };
  const result = await runFixtureResearch(input, {
    client,
    ...fixtureDependencies(),
    generateRole,
    todayUtc: "2026-11-01",
  });
  expect(result.errors).toEqual([]);
  expect(roles).toEqual(
    expect.arrayContaining([
      "reader",
      "research",
      "general",
      "tickets",
      "classification",
      "links",
      "editor",
    ]),
  );
  expect(new Set(dates)).toEqual(new Set(["2026-11-01T12:00:00.000Z"]));
});
test.each([{ ids: [] }, { ids: ["missing"] }])(
  "uncited General changes cannot reach Editor: %j",
  async ({ ids }) => {
    const { client } = testDatabase();
    const general = fixtureTargets();
    general.event.summary = set("Uncited", "Unsupported", ids);
    const editor = vi.fn();
    const result = await runFixtureResearch(input, {
      client,
      ...fixtureDependencies({ general, editor }),
    });
    expect(result.outcome).toBe("failed");
    expect(editor).not.toHaveBeenCalled();
    expect(readResearchCatalog(client)).toEqual([]);
  },
);
test("source overview alone does not authorize an Event change", async () => {
  const { client } = testDatabase();
  const general = fixtureTargets();
  general.event.summary = set("Uncited");
  const result = await runFixtureResearch(input, {
    client,
    ...fixtureDependencies({
      general,
      reader: {
        overview: "An Event summary",
        coverage: { found: [], notPublished: [] },
        topics: ["description"],
        statedYears: [],
        limitations: [],
        evidence: [],
      },
    }),
  });
  expect(result.outcome).toBe("failed");
  expect(result.operations).toEqual([]);
});
test("a nullable field uses clear and rejects set with a null value", async () => {
  const { client } = testDatabase();
  const general = fixtureTargets();
  const invalid = {
    ...general,
    event: { summary: { ...set("Value"), value: null } },
  };
  const result = await runFixtureResearch(input, {
    client,
    ...fixtureDependencies({ general: invalid }),
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "invalid_candidate" }),
  );
  expect(result.operations).toEqual([]);
  expect(clear()).toMatchObject({ action: "clear" });
});

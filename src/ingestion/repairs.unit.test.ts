import { expect, it, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { fixtureDependencies, fixtureTargets, set } from "@/test/ingestion";
import { CatalogAttempt } from "./attempt";
import { createIngestionData, type CatalogResearchInput } from "./contracts";
import { bindEvidence } from "./evidence/contracts";
import { proposalGroup, type GroupOwner, type ReturnRequest } from "./groups";
import { loadResearchContext } from "./research/context";
import { classificationReplySchema } from "./roles/classification/contracts";
import { generalOutputSchema } from "./roles/general/contracts";
import { linksOutputSchema } from "./roles/links/contracts";
import { ticketsOutputSchema } from "./roles/tickets/contracts";
import type { RoleConversation } from "./roles/invoke";

const sourceUrl = "https://example.org/";
const date = "2026-11-01T00:00:00Z";
const websitePath = "event.fields.links.website";
const ticketLinkPath = "currentOrNextEdition.fields.links.tickets";
const ticketsPath = "currentOrNextEdition.fields.tickets";
const ticketLink = "https://example.org/tickets";
const diagnostics = { checks: [], unresolved: [] };
const schemas = {
  classification: classificationReplySchema,
  general: generalOutputSchema,
  links: linksOutputSchema,
  tickets: ticketsOutputSchema,
} satisfies Partial<Record<GroupOwner, RoleConversation["schema"]>>;

function links(website?: unknown, tickets?: unknown) {
  return {
    event: { website, socials: {} },
    currentOrNextEdition: { tickets },
    omitted: [],
    ...diagnostics,
  };
}

function fixture(scope?: CatalogResearchInput["scope"]) {
  const { client } = testDatabase();
  const f = testFixtures(client);
  const event = f.event({ canonicalName: "Example Fest" });
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "test",
    scope,
  };
  const { generateRole } = fixtureDependencies();
  const attempt = new CatalogAttempt(event.id, input, { client, generateRole });
  const targets = fixtureTargets(event.id);
  const data = createIngestionData();
  const body = "Example Fest, July 2027.";
  data.corpus = {
    version: "fixture",
    sources: [
      {
        id: "s1",
        attemptedUrl: sourceUrl,
        finalUrl: sourceUrl,
        retrievedAt: date,
        status: "ok",
        method: "http",
        processing: "complete",
        limitations: [],
      },
    ],
    evidence: bindEvidence(
      "s1",
      body,
      {
        evidence: [{ quote: body, topics: ["identity", "dates"] }],
        limitations: [],
      },
      sourceUrl,
    ).evidence,
  };
  const signal = new AbortController().signal;
  const repairs = attempt.repairs;
  repairs.capture("links", { raw: links(), schema: linksOutputSchema });
  function loadContext() {
    data.context = loadResearchContext(client, input, date);
  }
  loadContext();
  function capture(owner: keyof typeof schemas, raw: unknown, output: unknown) {
    const revise = revision(output);
    repairs.capture(owner, { raw, revise, schema: schemas[owner] });
    return revise;
  }
  return {
    capture,
    repairs,
    targets,
    event,
    f,
    loadContext,
    general: () => repairs.general(attempt, data, signal),
    before: () => repairs.beforeReview(attempt, data, targets, signal),
    after: (...requests: ReturnRequest[]) =>
      repairs.afterReview(attempt, data, targets, requests, signal),
  };
}

function revision(output: unknown) {
  return vi.fn<NonNullable<RoleConversation["revise"]>>(async () => ({
    status: "success",
    output,
    modelResponse: null,
    errors: [],
    model: "fixture",
    promptVersion: "fixture",
    durationMs: 0,
  }));
}

function returnGroup(
  path: string,
  note = "Check the saved source.",
): ReturnRequest {
  return { group: proposalGroup(path)!, note };
}

it.each([
  "repeat",
  "unknown evidence",
  "editor omission",
  "unrelated question",
] as const)("checks the Tickets return boundary: %s", async (kind) => {
  const f = fixture();
  const raw = {
    ...diagnostics,
    currentOrNextEdition: {
      tickets: set({ variants: [], basePrice: null }, "Empty offers", [
        kind === "unknown evidence" ? "missing" : "s1-e1",
      ]),
    },
  };
  const question = {
    field: kind === "unrelated question" ? "tickets" : ticketsPath,
    message: "No applicable price.",
  };
  const omitted = {
    ...diagnostics,
    currentOrNextEdition: {},
    unresolved: [question],
  };
  const editor = kind === "editor omission" || kind === "unrelated question";
  const revise = f.capture("tickets", raw, kind === "repeat" ? raw : omitted);
  const result = editor ? f.after(returnGroup(ticketsPath)) : f.before();
  const error = {
    repeat: "empty offer list",
    "unknown evidence": "unknown evidence",
    "unrelated question": "exact group",
  };
  if (kind in error) {
    await expect(result).rejects.toThrow(error[kind as keyof typeof error]);
  } else {
    expect((await result).tickets).toEqual(omitted);
    expect(f.repairs.records[0]).toMatchObject({
      path: ticketsPath,
      omissionReason: question.message,
    });
  }
  expect(revise).toHaveBeenCalledTimes(kind === "unknown evidence" ? 0 : 1);
  if (kind === "repeat") {
    expect(f.repairs.records[0].failure).toMatchObject({ field: ticketsPath });
  }
});

it.each(["size", "dates", "target"] as const)(
  "only returns General validation errors with a fixed Edition: %s",
  async (kind) => {
    const f = fixture();
    const original = fixtureTargets(f.event.id);
    original.currentOrNextEdition!.fields.sizeEstimate = set(-1);
    if (kind === "dates") {
      original.currentOrNextEdition!.fields.dates = set({
        startsOn: "bad-date",
        endsOn: "2027-07-03",
        state: "confirmed",
      });
    }
    const raw =
      kind === "target"
        ? {
            ...original,
            currentOrNextEdition: {
              ...original.currentOrNextEdition,
              editionKey: 7,
            },
          }
        : original;
    const fixed = fixtureTargets(f.event.id);
    fixed.currentOrNextEdition!.fields.sizeEstimate = set(2000);
    const revise = f.capture("general", raw, fixed);
    if (kind === "size") {
      await expect(f.general()).resolves.toMatchObject({
        status: "continue",
        value: fixed,
      });
      expect(revise.mock.calls[0][0]).toMatchObject({
        groups: [{ path: "currentOrNextEdition.fields.sizeEstimate" }],
      });
    } else {
      await expect(f.general()).rejects.toThrow(
        kind === "target" ? "editionKey" : "temporal target",
      );
      expect(revise).not.toHaveBeenCalled();
    }
  },
);

it.each(["valid", "unknown reference", "outside scope"] as const)(
  "checks Links revisions before merging the requested group: %s",
  async (kind) => {
    const f = fixture(kind === "outside scope" ? "current" : "full");
    const original = links(
      kind === "outside scope" ? undefined : set("bad-url"),
      set(ticketLink),
    );
    const fixed = links(set(sourceUrl), 12);
    const revise = f.capture(
      "links",
      original,
      kind === "unknown reference"
        ? { ...fixed, checks: [{ sourceIds: ["missing"] }] }
        : fixed,
    );
    if (kind === "valid") {
      await expect(f.before()).resolves.toMatchObject({
        links: links(set(sourceUrl), set(ticketLink)),
      });
      expect(revise.mock.calls[0][0]).toMatchObject({
        groups: [
          { path: websitePath, note: expect.stringContaining("event.website") },
        ],
      });
    } else {
      const result =
        kind === "outside scope"
          ? f.after(returnGroup(ticketLinkPath))
          : f.before();
      const message =
        kind === "outside scope" ? "outside the assignment" : "unknown source";
      await expect(result).rejects.toThrow(message);
      expect(f.repairs.raw("links")).toEqual(original);
      expect(f.repairs.records[0].failure?.message).toContain(message);
    }
    expect(revise).toHaveBeenCalledOnce();
  },
);

it("batches Links groups and limits returns for each path", async () => {
  const f = fixture();
  const question = { field: "instagram", message: "Verify the social link." };
  const fixed = links(set(sourceUrl), set(ticketLink));
  const original = links(set("https://example.org/old"));
  const revise = f.capture(
    "links",
    { ...original, unresolved: [question] },
    fixed,
  );
  const requests = [
    returnGroup(websitePath, "Check the official site."),
    returnGroup(ticketLinkPath, "Read the ticket overview."),
  ];
  await expect(f.after(...requests)).resolves.toMatchObject({
    links: { ...fixed, unresolved: [question] },
  });
  expect(revise.mock.calls[0][0]).toMatchObject({
    groups: [
      { path: websitePath, note: requests[0].note },
      { path: ticketLinkPath, note: requests[1].note, original: null },
    ],
  });
  await f.after(requests[0]);
  await f.after(requests[0]);
  await expect(f.after(requests[0])).rejects.toThrow("no returns left");
  expect(revise).toHaveBeenCalledTimes(3);
  expect(f.repairs.returnCounts.get(ticketLinkPath)).toBe(1);
});

it.each(["omit", "excess"] as const)(
  "batches Classification conflicts: %s",
  async (kind) => {
    const f = fixture();
    const previous = f.f.edition(f.event, {
      editionKey: "2026",
      editionYear: 2026,
    });
    const festival = f.f.existingTerm("event_type", "festival");
    const gathering = f.f.existingTerm("event_type", "gathering");
    f.f.assignTerm(previous, festival);
    f.targets.previousEdition = {
      editionKey: "2026",
      reason: "Completed Edition",
      evidenceIds: ["s1-e1"],
      fields: {},
    };
    f.loadContext();
    const previousPath = "previousEdition.fields.classification";
    const currentPath = "currentOrNextEdition.fields.classification";
    const answer = (classification: unknown) => ({
      previousEdition: { classification: set(classification) },
      currentOrNextEdition: { classification: set(classification) },
      ...diagnostics,
    });
    const raw = answer({ eventType: [festival.slug, gathering.slug] });
    const reason = "The previous type remains uncertain.";
    const fixed = {
      ...answer({ eventType: festival.slug }),
      previousEdition: {},
      unresolved: [{ field: previousPath, message: reason }],
    };
    const revise = f.capture(
      "classification",
      raw,
      kind === "excess" ? raw : fixed,
    );
    const diagnostic = "classification.value.eventType:invalid_type";
    if (kind === "excess") {
      await expect(f.before()).rejects.toThrow(diagnostic);
      expect(f.repairs.records[0].failure).toMatchObject({
        field: previousPath,
        code: "invalid_plan",
      });
    } else {
      expect((await f.before()).classification).toEqual({
        ...fixed,
        currentOrNextEdition: { classification: set([festival.id]) },
      });
      expect(f.repairs.records[0].omissionReason).toBe(reason);
    }
    expect(revise).toHaveBeenCalledOnce();
    expect(revise.mock.calls[0][0]).toMatchObject({
      groups: [previousPath, currentPath].map((path) => ({
        path,
        note: expect.stringContaining(diagnostic),
      })),
    });
  },
);

it.each(["term", "reuse Edition"] as const)(
  "returns an unknown Classification %s with correction instructions",
  async (kind) => {
    const f = fixture();
    const term = f.f.existingTerm("event_type", "festival");
    const path = "currentOrNextEdition.fields.classification";
    const unknown = kind === "term" ? term.slug : "2090";
    const fixed = {
      previousEdition: null,
      currentOrNextEdition: { classification: set({ eventType: term.slug }) },
      ...diagnostics,
    };
    const classification =
      kind === "term"
        ? set({ genres: [unknown] })
        : {
            ...set({ eventType: term.slug }),
            reuseFrom: { editionKey: unknown, reason: "Same format." },
          };
    const revise = f.capture(
      "classification",
      { ...fixed, currentOrNextEdition: { classification } },
      fixed,
    );

    expect((await f.before()).classification).toEqual({
      ...fixed,
      currentOrNextEdition: { classification: set([term.id]) },
    });
    expect(revise).toHaveBeenCalledOnce();
    const note = expect.stringContaining(JSON.stringify(unknown));
    expect(revise.mock.calls[0][0]).toMatchObject({
      groups: [{ path, note, original: classification }],
    });
    expect(f.repairs.records[0].note).toContain(
      kind === "term" ? "supplied vocabulary" : "earlier saved Edition",
    );
    expect(f.repairs.records[0].note).toContain("omit the group with a reason");
  },
);

it.each(["supported removal", "uncited removal", "unknown slug"] as const)(
  "checks %s in a Classification group returned by Editor",
  async (kind) => {
    const f = fixture();
    const path = "currentOrNextEdition.fields.classification";
    const edition = f.f.edition(f.event, {
      editionKey: "2027",
      editionYear: 2027,
    });
    const term = f.f.existingTerm("event_type", "festival");
    const genre = f.f.term();
    f.f.assignTerm(edition, term);
    f.f.assignTerm(edition, genre);
    f.loadContext();
    const original = {
      previousEdition: null,
      currentOrNextEdition: { classification: set({ genres: [genre.slug] }) },
      ...diagnostics,
    };
    const change = set({
      genres: kind === "unknown slug" ? ["unknown-term"] : [],
    });
    if (kind === "uncited removal") {
      change.evidenceIds = [];
    }
    const revised = {
      ...original,
      currentOrNextEdition: { classification: change },
    };
    const revise = f.capture("classification", original, revised);

    await f.before();
    if (kind === "supported removal") {
      expect((await f.after(returnGroup(path))).classification).toEqual({
        ...original,
        currentOrNextEdition: { classification: set([term.id]) },
      });
      expect(f.repairs.raw("classification")).toEqual(revised);
    } else {
      await expect(f.after(returnGroup(path))).rejects.toThrow(
        kind === "unknown slug"
          ? "unknown-term"
          : "Missing or unknown evidence reference",
      );
      expect(f.repairs.raw("classification")).toEqual(original);
      expect(f.repairs.records[0].failure).toMatchObject({
        code: "invalid_plan",
        field: path,
      });
    }
    expect(revise).toHaveBeenCalledOnce();
  },
);

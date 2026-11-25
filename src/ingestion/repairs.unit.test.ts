import { expect, it, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { fixtureTargets, set } from "@/test/ingestion";
import type { CatalogResearchInput } from "./contracts";
import { bindEvidence, type FrozenCorpus } from "./evidence/contracts";
import {
  assignedGroups,
  proposalGroup,
  type GroupOwner,
  type ReturnRequest,
} from "./groups";
import { ProposalRepairs } from "./repairs";
import { loadResearchContext, type ResearchContext } from "./research/context";
import { classificationReplySchema } from "./roles/classification/contracts";
import { generalOutputSchema } from "./roles/general/contracts";
import { linksOutputSchema } from "./roles/links/contracts";
import { ticketsOutputSchema } from "./roles/tickets/contracts";
import type { RoleConversation } from "./roles/invoke";
import { resolveSavedEditions } from "./roles/options";

const sourceUrl = "https://example.org/";
const date = "2026-11-01T00:00:00Z";
const websitePath = "event.fields.links.website";
const ticketLinkPath = "currentOrNextEdition.fields.links.tickets";
const ticketsPath = "currentOrNextEdition.fields.tickets";
const ticketLink = "https://example.org/tickets";
const diagnostics = { checks: [], unresolved: [] };
const editorFailure = {
  code: "model_failed",
  stage: "editor",
  message: "Targeted Editor fixture failure",
} as const;
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

function repairFixture(
  input: CatalogResearchInput,
  getContext: () => ResearchContext,
) {
  const targets = fixtureTargets(input.eventId);
  const body = "Example Fest, July 2027.";
  const corpus: FrozenCorpus = {
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
  const repairs = new ProposalRepairs();
  repairs.capture("links", { raw: links(), schema: linksOutputSchema });
  const context = () => {
    const { catalog, currentDate, terms } = getContext();
    return { corpus, currentDate, terms, savedEvent: catalog[0], input };
  };
  const targeted = () => {
    const base = context();
    return {
      ...base,
      targets,
      groups: assignedGroups(input.scope, targets),
      savedEditions: resolveSavedEditions(base.savedEvent, targets),
    };
  };
  function capture(owner: keyof typeof schemas, raw: unknown, output: unknown) {
    const revise = revision(output);
    repairs.capture(owner, { raw, revise, schema: schemas[owner] });
    return revise;
  }
  return {
    capture,
    repairs,
    targets,
    general: () => repairs.general(context(), signal),
    before: () => repairs.beforeReview(targeted(), signal),
    after: (...requests: ReturnRequest[]) =>
      repairs.afterReview(targeted(), requests, signal),
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
  let context = loadResearchContext(client, input, date);
  return {
    ...repairFixture(input, () => context),
    event,
    f,
    loadContext() {
      context = loadResearchContext(client, input, date);
    },
  };
}

function generalFixture() {
  return repairFixture({ mode: "add", actor: "test" }, () => ({
    catalog: [],
    knownLinks: [],
    terms: [],
    currentDate: date,
  }));
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
  const result = editor
    ? f.after(returnGroup(ticketsPath)).then(({ outputs }) => outputs)
    : f.before();
  if (kind === "unknown evidence") {
    await expect(result).rejects.toThrow("unknown evidence");
  } else if (kind === "editor omission") {
    expect((await result).tickets).toEqual(omitted);
    expect(f.repairs.records[0]).toMatchObject({
      path: ticketsPath,
      omissionReason: question.message,
    });
  } else {
    expect((await result).tickets?.currentOrNextEdition).toEqual({});
    expect(f.repairs.records.at(-1)).toMatchObject({
      path: ticketsPath,
      failure: {
        field: ticketsPath,
        message: expect.stringContaining(
          kind === "repeat" ? "empty offer list" : "exact group",
        ),
      },
      decision: { path: ticketsPath, decision: "reject" },
    });
    expect(revise.mock.calls[1][0]).toMatchObject({
      groups: [
        {
          path: ticketsPath,
          note: expect.stringContaining(
            kind === "repeat" ? "empty offer list" : ticketsPath,
          ),
        },
      ],
    });
  }
  expect(revise).toHaveBeenCalledTimes(
    kind === "unknown evidence" ? 0 : kind === "editor omission" ? 1 : 3,
  );
});

it.each(["size", "dates", "target"] as const)(
  "only returns General validation errors with a fixed Edition: %s",
  async (kind) => {
    const f = generalFixture();
    const original = structuredClone(f.targets);
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
    const fixed = structuredClone(f.targets);
    fixed.currentOrNextEdition!.fields.sizeEstimate = set(2000, undefined, []);
    const revise = f.capture("general", raw, fixed);
    if (kind === "size") {
      await expect(f.general()).resolves.toMatchObject({
        targets: { status: "continue", value: fixed },
        revisedOutput: fixed,
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
    const repairedWebsite = set(sourceUrl, undefined, []);
    const fixed = links(repairedWebsite, 12);
    const revise = f.capture(
      "links",
      original,
      kind === "unknown reference"
        ? { ...fixed, checks: [{ sourceIds: ["missing"] }] }
        : fixed,
    );
    if (kind === "valid") {
      await expect(f.before()).resolves.toMatchObject({
        links: links(repairedWebsite, set(ticketLink)),
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
  const first = await f.after(...requests);
  expect(first.outputs.links).toEqual({ ...fixed, unresolved: [question] });
  expect(first.records.map(({ path }) => path)).toEqual([
    websitePath,
    ticketLinkPath,
  ]);
  const second = await f.after(requests[0]);
  expect(second.records).toMatchObject([
    { path: websitePath, note: requests[0].note },
  ]);
  expect(revise.mock.calls[0][0]).toMatchObject({
    groups: [
      { path: websitePath, note: requests[0].note },
      { path: ticketLinkPath, note: requests[1].note, original: null },
    ],
  });
  await f.after(requests[0]);
  await expect(f.after(requests[0])).rejects.toThrow("no returns left");
  expect(revise).toHaveBeenCalledTimes(3);
  expect(f.repairs.returnCounts.get(ticketLinkPath)).toBe(1);

  second.recordEditorFailure(editorFailure);
  expect(f.repairs.records.map(({ path, failure }) => [path, failure])).toEqual(
    [
      [websitePath, undefined],
      [ticketLinkPath, undefined],
      [websitePath, editorFailure],
      [websitePath, undefined],
    ],
  );
});

it("keeps a valid peer and retries only the local omission error", async () => {
  const f = fixture();
  const socialPath = "event.fields.links.socials.instagram";
  const original = links(set(sourceUrl), set("https://example.org/product"));
  original.event.socials = { instagram: set("https://instagram.com/disputed") };
  const corrected = links(
    set("https://example.org/unrequested"),
    set(ticketLink),
  );
  const revise = f.capture("links", original, corrected);
  revise.mockImplementation(async () => ({
    status: "success",
    output:
      revise.mock.calls.length === 1
        ? corrected
        : links(undefined, set("https://example.org/unrequested-ticket")),
    modelResponse: null,
    errors: [],
    model: "fixture",
    promptVersion: "fixture",
    durationMs: 0,
  }));

  const result = await f.after(
    returnGroup(socialPath),
    returnGroup(ticketLinkPath),
  );
  expect(result.outputs.links).toEqual(links(set(sourceUrl), set(ticketLink)));
  expect(revise).toHaveBeenCalledTimes(3);
  for (const [request] of revise.mock.calls.slice(1)) {
    expect(request).toMatchObject({
      groups: [{ path: socialPath, note: expect.stringContaining(socialPath) }],
    });
  }
  expect(
    f.repairs.records.filter(({ path }) => path === ticketLinkPath),
  ).toMatchObject([{ revision: set(ticketLink) }]);
  expect(
    f.repairs.records.find(({ path }) => path === ticketLinkPath)?.failure,
  ).toBeUndefined();
  expect(f.repairs.records.at(-1)).toMatchObject({
    path: socialPath,
    decision: { decision: "reject", path: socialPath },
  });

  result.recordEditorFailure(editorFailure);
  expect(f.repairs.records.map(({ failure }) => failure)).toEqual(
    Array(4).fill(editorFailure),
  );
});

it("continues another owner after a local validation repair is exhausted", async () => {
  const f = fixture();
  const invalidTickets = {
    ...diagnostics,
    currentOrNextEdition: { tickets: set({ variants: [], basePrice: null }) },
  };
  const tickets = f.capture("tickets", invalidTickets, invalidTickets);
  const link = f.capture("links", links(set("bad-url")), links(set(sourceUrl)));
  const result = await f.before();
  expect(result.tickets?.currentOrNextEdition).toEqual({});
  expect(result.links).toEqual(links(set(sourceUrl)));
  expect(tickets).toHaveBeenCalledTimes(3);
  expect(link).toHaveBeenCalledOnce();
  expect(f.repairs.records.at(-1)).toMatchObject({ path: websitePath });
  expect(f.repairs.records.at(-1)?.failure).toBeUndefined();
});

it.each([
  "target",
  "reference",
  "country",
  "temporal role",
  "temporal role with an invalid start",
] as const)(
  "stops a General revision with a valid peer and a fatal %s error",
  async (kind) => {
    const f = fixture();
    f.f.edition(f.event, { editionKey: "2027", countryCode: "PT" });
    f.loadContext();
    const original = f.targets;
    const revised = structuredClone(original);
    revised.currentOrNextEdition!.fields.sizeEstimate = set(2000);
    if (kind === "target") {
      revised.currentOrNextEdition!.editionKey = "changed";
    } else if (kind === "reference") {
      revised.checks[0].sourceIds = ["missing"];
    } else if (kind === "country") {
      revised.festivalCountries = [
        { countryCode: "ES", evidenceIds: ["s1-e1"] },
      ];
    } else {
      revised.currentOrNextEdition!.fields.dates = set({
        startsOn: kind === "temporal role" ? "2025-07-01" : "bad-date",
        endsOn: "2025-07-03",
        state: "confirmed",
      });
    }
    const revise = f.capture("general", original, revised);
    const message = {
      target: "fixed identity or target",
      reference: "unknown source",
      country: "country",
      "temporal role": "has ended",
      "temporal role with an invalid start": "has ended",
    }[kind];
    await expect(
      f.after(
        returnGroup("currentOrNextEdition.fields.sizeEstimate"),
        returnGroup("currentOrNextEdition.fields.dates"),
      ),
    ).rejects.toThrow(message);
    expect(revise).toHaveBeenCalledOnce();
    expect(f.repairs.raw("general")).toEqual(original);
  },
);

it("repairs a local General date error and keeps the valid peer revision", async () => {
  const f = generalFixture();
  const original = f.targets;
  const revised = structuredClone(original);
  revised.currentOrNextEdition!.fields.sizeEstimate = set(2000);
  revised.currentOrNextEdition!.fields.dates = set({
    startsOn: "bad-date",
    endsOn: "2027-07-03",
    state: "confirmed",
  });
  const corrected = structuredClone(original);
  corrected.currentOrNextEdition!.fields.dates = set({
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
    state: "confirmed",
  });
  const revise = f.capture("general", original, revised);
  revise.mockImplementationOnce(revision(revised));
  revise.mockImplementationOnce(revision(corrected));

  const { generalTargets } = await f.after(
    returnGroup("currentOrNextEdition.fields.sizeEstimate"),
    returnGroup("currentOrNextEdition.fields.dates"),
  );
  expect(generalTargets).toEqual({
    ...corrected,
    currentOrNextEdition: {
      ...corrected.currentOrNextEdition,
      fields: {
        ...corrected.currentOrNextEdition!.fields,
        sizeEstimate: set(2000),
      },
    },
  });
  expect(revise).toHaveBeenCalledTimes(2);
  expect(revise.mock.calls[1][0]).toMatchObject({
    groups: [{ path: "currentOrNextEdition.fields.dates" }],
  });
  expect(f.repairs.records.at(-1)?.failure).toBeUndefined();
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
      expect((await f.before()).classification).toMatchObject({
        previousEdition: {},
        currentOrNextEdition: {},
      });
      expect(f.repairs.records.at(-2)).toMatchObject({
        failure: { field: previousPath, code: "invalid_plan" },
        decision: { path: previousPath, decision: "reject" },
      });
    } else {
      expect((await f.before()).classification).toEqual({
        ...fixed,
        currentOrNextEdition: { classification: set([festival.id]) },
      });
      expect(f.repairs.records[0].omissionReason).toBe(reason);
    }
    expect(revise).toHaveBeenCalledTimes(kind === "excess" ? 3 : 1);
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

it.each(["uncited removal", "unknown slug", "unknown evidence"] as const)(
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
    const genres = kind === "unknown slug" ? ["unknown-term"] : [];
    const evidenceIds = kind === "unknown evidence" ? ["missing"] : [];
    const change = set({ genres }, undefined, evidenceIds);
    const revised = {
      ...original,
      currentOrNextEdition: { classification: change },
    };
    const revise = f.capture("classification", original, revised);

    await f.before();
    if (kind === "uncited removal") {
      expect((await f.after(returnGroup(path))).outputs.classification).toEqual(
        {
          ...original,
          currentOrNextEdition: {
            classification: { ...change, value: [term.id] },
          },
        },
      );
      expect(f.repairs.raw("classification")).toEqual(revised);
    } else if (kind === "unknown evidence") {
      await expect(f.after(returnGroup(path))).rejects.toThrow(
        "unknown evidence reference",
      );
      expect(f.repairs.raw("classification")).toEqual(original);
      expect(f.repairs.records[0].failure).toMatchObject({
        code: "invalid_candidate",
      });
    } else {
      expect(
        (await f.after(returnGroup(path))).outputs.classification,
      ).toMatchObject({
        currentOrNextEdition: {},
      });
      expect(f.repairs.records.at(-1)).toMatchObject({
        failure: { code: "invalid_plan", field: path },
        decision: { decision: "reject", path },
      });
    }
    expect(revise).toHaveBeenCalledTimes(kind === "unknown slug" ? 3 : 1);
  },
);

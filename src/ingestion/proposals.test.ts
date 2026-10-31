import { expect, it } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { loadResearchContext } from "./research/context";
import {
  validateGeneral,
  assembleProposals,
  applyReview,
  reviewSchema,
} from "./proposals";
import {
  generalOutputSchema,
  ticketsOutputSchema,
  classificationOutputSchema,
  linksOutputSchema,
} from "./roles/contracts";
import type { Targets } from "./roles/contracts";
import type { FrozenCorpus } from "./evidence/contracts";
import { buildAssignment } from "./roles/assignment";

function fixture() {
  const db = testDatabase();
  const f = testFixtures(db.client);
  const event = f.event({ canonicalName: "Example Festival" });
  const edition = f.edition(event, { editionKey: "2027", editionYear: 2027 });
  const terms = f.festivalTerms();
  terms.forEach((term) => f.assignTerm(edition, term));
  const input = { mode: "refresh" as const, eventId: event.id, actor: "test" };
  const context = loadResearchContext(db.client, input, "2026-10-31T12:00:00Z");
  const corpus: FrozenCorpus = {
    version: "frozen",
    sources: [
      {
        id: "s1",
        attemptedUrl: "https://example.org/",
        finalUrl: "https://example.org/",
        retrievedAt: "2026-10-31T00:00:00Z",
        status: "ok",
        method: "http",
        processing: "complete",
        limitations: [],
      },
    ],
    evidence: [
      {
        id: "s1-e1",
        sourceId: "s1",
        quote: "Example Festival 2027",
        span: { start: 0, end: 21 },
        context: [],
        topics: ["identity", "classification"],
        editionClues: ["2027"],
        uncertainty: null,
        anchors: [],
      },
    ],
  };
  const targets: Targets = {
    decision: "targets",
    eventId: event.id,
    observedEventName: event.canonicalName,
    reason: "Official identity",
    evidenceIds: ["s1-e1"],
    event: {},
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      reason: "Future Edition",
      evidenceIds: ["s1-e1"],
      fields: {},
    },
    checks: [],
    unresolved: [],
  };
  const assemble = (
    selected = terms.map((term) => term.id),
    evidenceIds: string[] = [],
    reuseFrom?: { editionKey: string; reason: string },
  ) => {
    const checked = validateGeneral(targets, context, input, corpus);
    if (checked.status !== "continue") {
      throw new Error("Fixture target rejected");
    }
    return assembleProposals({
      targets: checked.value,
      corpus,
      context,
      input,
      points: [],
      location: { slots: {}, support: {}, previousPoints: [], unresolved: [] },
      tickets: null,
      links: {
        event: { socials: {} },
        currentOrNextEdition: {},
        omitted: [],
        checks: [],
        unresolved: [],
      },
      classification: {
        previousEdition: null,
        currentOrNextEdition: {
          classification: {
            action: "set",
            value: selected,
            reason: "Retain observed terms",
            evidenceIds,
            ...(reuseFrom ? { reuseFrom } : {}),
          },
        },
        checks: [],
        unresolved: [],
      },
    });
  };
  return {
    input,
    context,
    corpus,
    targets,
    terms,
    assemble,
    f,
    event,
    client: db.client,
  };
}
it("requires an explicit supported duplicate decision for add", () => {
  const f = fixture();
  expect(
    validateGeneral(
      f.targets,
      f.context,
      { mode: "add", actor: "test" },
      f.corpus,
    ).status,
  ).toBe("reject");
  expect(
    validateGeneral(
      {
        decision: "duplicate",
        eventId: f.targets.eventId!,
        observedEventName: "Example Festival",
        reason: "Same festival",
        evidenceIds: ["s1-e1"],
      },
      f.context,
      { mode: "add", actor: "test" },
      f.corpus,
    ).status,
  ).toBe("skip");
  const unknown = { ...f.targets, eventId: "outside" };
  expect(validateGeneral(unknown, f.context, f.input, f.corpus).status).toBe(
    "reject",
  );
  expect(
    validateGeneral(
      { ...f.targets, evidenceIds: ["unknown"] },
      f.context,
      f.input,
      f.corpus,
    ).status,
  ).toBe("reject");
  expect(
    validateGeneral(
      { decision: "uncertain", reason: "Identity unclear", unresolved: [] },
      f.context,
      { mode: "add", actor: "test" },
      f.corpus,
    ).status,
  ).toBe("reject");
});
it("preserves saved terms without new evidence and rejects unsupported removal", () => {
  const f = fixture();
  expect(f.assemble().status).toBe("continue");
  expect(f.assemble([f.terms[0].id]).status).toBe("reject");
  expect(f.assemble([f.terms[0].id], ["s1-e1"]).status).toBe("continue");
  expect(f.targets.currentOrNextEdition!.fields).toEqual({});
});
it("rejects cross-role fields and removed reference fields", () => {
  const f = fixture();
  expect(
    generalOutputSchema.safeParse({ ...f.targets, pointRefs: [] }).success,
  ).toBe(false);
  expect(
    generalOutputSchema.safeParse({ ...f.targets, event: { links: {} } })
      .success,
  ).toBe(false);
  expect(
    ticketsOutputSchema.safeParse({
      currentOrNextEdition: {
        tickets: {
          action: "set",
          reason: "Price",
          evidenceIds: ["s1-e1"],
          value: {
            variants: [
              {
                label: "Pass",
                amount: 100,
                currency: "EUR",
                url: "https://example.org/buy",
              },
            ],
            basePrice: null,
          },
        },
      },
      checks: [],
      unresolved: [],
    }).success,
  ).toBe(false);
  expect(
    classificationOutputSchema.safeParse({
      previousEdition: null,
      currentOrNextEdition: null,
      status: "success",
      checks: [],
      unresolved: [],
    }).success,
  ).toBe(false);
  expect(
    linksOutputSchema.safeParse({
      event: { socials: {} },
      currentOrNextEdition: {},
      tickets: {},
      omitted: [],
      checks: [],
      unresolved: [],
    }).success,
  ).toBe(false);
});
it("Editor decisions have exact fixed keys and cannot replace values", () => {
  const f = fixture();
  const p = f.assemble();
  if (p.status !== "continue") {
    throw new Error("Rejected fixture");
  }
  const approve = (schema: Record<string, unknown>): unknown => {
    if (schema.type === "null") {
      return null;
    }
    if (schema.type === "array") {
      return [];
    }
    const properties = schema.properties as Record<
      string,
      Record<string, unknown>
    >;
    if (properties.decision) {
      return { decision: "approve", reason: "Supported" };
    }
    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, approve(value)]),
    );
  };
  const raw = approve(awaitSchema(p.value)) as Record<string, unknown>;
  expect(applyReview(p.value, raw).status).toBe("continue");
  expect(applyReview(p.value, { ...raw, pointRefs: [] }).status).toBe("reject");
  expect(
    applyReview(p.value, {
      ...raw,
      item: { decision: "approve", reason: "Supported", value: "replacement" },
    }).status,
  ).toBe("reject");
  expect(
    applyReview(p.value, {
      ...raw,
      item: { decision: "reject", reason: "Wrong identity" },
    }).status,
  ).toBe("reject");
});
import { z } from "zod";
const awaitSchema = (p: Parameters<typeof reviewSchema>[0]) =>
  z.toJSONSchema(reviewSchema(p)) as Record<string, unknown>;
it("builds concrete assignments with current exclusions", () => {
  const f = fixture();
  const current = buildAssignment({ ...f.input, scope: "current" }, f.context);
  expect(current).not.toHaveProperty("mode");
  expect(current).not.toHaveProperty("scope");
  expect(current.sourcePolicy).toMatchObject({
    discoveryAllowed: false,
    recoverWebsite: false,
  });
  expect(current.permissions).toEqual({
    eventFields: false,
    previousEdition: false,
    currentOrNextEdition: true,
  });
  expect(buildAssignment(f.input, f.context).permissions.eventFields).toBe(
    true,
  );
});

it("rejects unknown classification reuse and removes reuse after its target is rejected", () => {
  const f = fixture();
  const selected = f.terms.map((term) => term.id);
  expect(
    f.assemble(selected, ["s1-e1"], {
      editionKey: "outside",
      reason: "Continuity",
    }).status,
  ).toBe("reject");
  f.f.edition(f.event, {
    editionKey: "2025",
    editionYear: 2025,
    startsOn: "2025-06-01",
    endsOn: "2025-06-03",
  });
  const updated = loadResearchContext(f.client, f.input, f.context.currentDate);
  f.context.catalog = updated.catalog;
  f.targets.previousEdition = {
    editionKey: "2025",
    reason: "Completed festival",
    evidenceIds: ["s1-e1"],
    fields: {},
  };
  const prepared = f.assemble(selected, ["s1-e1"], {
    editionKey: "2025",
    reason: "Source confirms continuity",
  });
  if (prepared.status !== "continue") {
    throw new Error("Fixture rejected");
  }
  const review = approveReview(awaitSchema(prepared.value)) as Record<
    string,
    unknown
  >;
  (review.previousEdition as { target: unknown }).target = {
    decision: "reject",
    reason: "Wrong festival year",
  };
  const accepted = applyReview(prepared.value, review);
  expect(accepted.status).toBe("continue");
  if (accepted.status !== "continue") {
    throw new Error("Review rejected");
  }
  expect(accepted.value.plan.previousEdition).toBeNull();
  expect(accepted.value.plan.currentOrNextEdition?.editionKey).toBe("2027");
  expect(
    accepted.value.plan.currentOrNextEdition?.fields.classification,
  ).toBeUndefined();
});

function approveReview(schema: Record<string, unknown>): unknown {
  if (schema.type === "null") {
    return null;
  }
  if (schema.type === "array") {
    return [];
  }
  const properties = schema.properties as Record<
    string,
    Record<string, unknown>
  >;
  if (properties.decision) {
    return { decision: "approve", reason: "Supported" };
  }
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      approveReview(value),
    ]),
  );
}

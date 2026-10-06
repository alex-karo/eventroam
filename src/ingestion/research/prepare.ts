import { createHash, randomUUID } from "node:crypto";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type {
  CatalogOperation,
  CatalogOperationMeta,
} from "@/catalog/operations/operation";
import type { readResearchCatalog } from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import {
  researchCandidateSchema,
  type ResearchCandidate,
  type ResearchGap,
} from "./contracts";

export type ResearchCatalog = ReturnType<typeof readResearchCatalog>;
type DraftOperation = CatalogOperation extends infer Op
  ? Op extends CatalogOperation
    ? Omit<Op, keyof CatalogOperationMeta | "expectedVersion">
    : never
  : never;
type Term = { id: string; facet: string; slug: string };

function slug(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, 100)
    .replace(/-$/, "");
  return (
    ascii ||
    `event-${createHash("sha256").update(value.normalize("NFKC")).digest("hex").slice(0, 12)}`
  );
}

/** Turn one model answer into catalog operations. Source interpretation belongs to the model. */
export function prepareResearch(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: Term[],
): {
  candidate: ResearchCandidate | null;
  operations: CatalogOperation[];
  gaps: ResearchGap[];
  matchedEventId?: string;
} {
  const operations: CatalogOperation[] = [];
  const parsed = researchCandidateSchema.safeParse(raw);
  if (!parsed.success)
    return {
      candidate: null,
      operations,
      gaps: [
        {
          code: "invalid_candidate",
          detail: parsed.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join(".")}:${issue.code}`)
            .join(", "),
        },
      ],
    };
  const candidate = parsed.data;
  const gaps: ResearchGap[] = candidate.observations.map(({ detail }) => ({
    code: "observation",
    detail,
  }));
  const result = {
    candidate,
    operations,
    gaps,
    matchedEventId: candidate.eventId ?? input.eventId,
  };
  const event = catalog.find((item) => item.id === result.matchedEventId);
  if (
    (result.matchedEventId && !event) ||
    (input.eventId &&
      candidate.eventId &&
      input.eventId !== candidate.eventId) ||
    (!event && input.mode !== "add")
  ) {
    gaps.push({
      code: "ambiguous_identity",
      detail: "Event is outside the requested catalog target",
    });
    return result;
  }
  const keys = candidate.editions.map((edition) => edition.key);
  if (
    new Set(keys).size !== keys.length ||
    [...candidate.claims, ...candidate.prices].some(
      (item) => !keys.includes(item.editionKey),
    ) ||
    candidate.links.some((link) =>
      link.owner === "occurrence"
        ? !link.editionKey || !keys.includes(link.editionKey)
        : !!link.editionKey,
    ) ||
    new Set(candidate.prices.map((price) => price.editionKey)).size !==
      candidate.prices.length
  ) {
    gaps.push({
      code: "invalid_candidate",
      detail: "Duplicate or unknown edition key",
    });
    return result;
  }

  const add = (
    draft: DraftOperation,
    expectedVersion?: number,
    tempKey?: string,
  ) => {
    operations.push({
      ...draft,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      ...(tempKey ? { tempKey } : {}),
      operationKey: randomUUID(),
      actor: input.actor,
      ...(input.initiatedBy ? { initiatedBy: input.initiatedBy } : {}),
    } as CatalogOperation);
  };
  const eventRef = event?.id ?? "$event";
  if (!event) {
    add(
      {
        kind: "createEvent",
        data: {
          // Accepted v1 limit: colliding names fail the item write; no slug fallback yet.
          slug: slug(candidate.eventName),
          canonicalName: candidate.eventName,
          ...(candidate.summary === undefined
            ? {}
            : { summary: candidate.summary }),
        },
      },
      undefined,
      "event",
    );
  } else if (
    candidate.summary !== undefined &&
    candidate.summary !== event.summary
  ) {
    add(
      {
        kind: "updateEvent",
        id: event.id,
        data: { summary: candidate.summary },
      },
      event.version,
    );
  }

  const addLinks = (
    owner: { type: "event" | "occurrence"; id: string },
    previous: ResearchCatalog[number]["links"],
    version: number,
    editionKey?: string,
  ) => {
    const proposed = candidate.links.filter(
      (link) => link.owner === owner.type && link.editionKey === editionKey,
    );
    if (!proposed.length) return;
    const merged = new Map(
      previous.map((link) => [
        `${link.kind}:${normalizeCatalogUrl(link.url)}`,
        {
          kind: link.kind,
          url: normalizeCatalogUrl(link.url),
          label: link.label,
          official: link.official,
          sourceId: link.sourceId,
        },
      ]),
    );
    for (const link of proposed) {
      const key = `${link.kind}:${normalizeCatalogUrl(link.url)}`;
      const saved = merged.get(key);
      merged.set(key, {
        kind: link.kind,
        url: normalizeCatalogUrl(link.url),
        label: link.label ?? saved?.label ?? null,
        official: true,
        sourceId: saved?.sourceId ?? null,
      });
    }
    add({ kind: "replaceLinks", owner, links: [...merged.values()] }, version);
  };
  addLinks(
    { type: "event", id: eventRef },
    event?.links ?? [],
    event?.version ?? 1,
  );

  let willPublishOccurrence = false;
  for (const edition of candidate.editions) {
    const existing = event?.editions.find(
      (item) => item.occurrenceKey === edition.key,
    );
    const id = existing?.id ?? `$occ_${candidate.editions.indexOf(edition)}`;
    const claims = candidate.claims.filter(
      (claim) => claim.editionKey === edition.key,
    );
    const data: Record<string, unknown> = {};
    let additions: string[] = [];
    let removals: string[] = [];
    for (const claim of claims) {
      if (claim.field === "termIds") additions = claim.value as string[];
      else if (claim.field === "removeTermIds")
        removals = claim.value as string[];
      else data[claim.field] = claim.value;
    }
    if (edition.year !== undefined) data.occurrenceYear = edition.year;
    if (edition.status === "cancelled" && data.scheduleStatus === undefined)
      data.scheduleStatus = "cancelled";
    const version = existing?.version ?? 1;
    if (!existing) {
      add(
        {
          kind: "createOccurrence",
          eventId: eventRef,
          data: { occurrenceKey: edition.key, ...data },
        } as DraftOperation,
        undefined,
        id.slice(1),
      );
    } else if (Object.keys(data).length) {
      add({ kind: "updateOccurrence", id, data } as DraftOperation, version);
    }
    const priorTerms = existing?.terms.map((term) => term.id) ?? [];
    const nextTerms = [...new Set([...priorTerms, ...additions])].filter(
      (term) => !removals.includes(term),
    );
    if (additions.length || removals.length)
      add({ kind: "replaceTerms", id, termIds: nextTerms }, version);

    const price = candidate.prices.find(
      (item) => item.editionKey === edition.key,
    );
    if (price)
      add(
        {
          kind: "replacePriceBlock",
          id,
          priceDetails: price.priceDetails,
          basePrice: price.basePrice,
        },
        version,
      );
    addLinks(
      { type: "occurrence", id },
      existing?.links ?? [],
      version,
      edition.key,
    );

    const state = { ...existing, ...data };
    const hasScope = (facet: string, allowed: string[]) =>
      nextTerms.some((id) => {
        const term = terms.find((item) => item.id === id);
        return term?.facet === facet && allowed.includes(term.slug);
      });
    const publishable =
      state.occurrenceYear != null &&
      state.startsOn != null &&
      state.endsOn != null &&
      state.countryCode != null &&
      (state.venueName != null ||
        state.locality != null ||
        state.administrativeArea != null) &&
      hasScope("format", ["outdoor", "mixed-indoor-outdoor"]) &&
      hasScope("event_type", ["festival", "gathering"]) &&
      (hasScope("topic", ["music"]) || hasScope("culture", ["burning-like"]));
    if (
      publishable &&
      (!existing ||
        existing.publicationState === "draft" ||
        (existing.publicationState === "withdrawn" && input.republish))
    ) {
      add({ kind: "publishOccurrence", id }, version);
      willPublishOccurrence = true;
    }
  }
  if (
    (!event ||
      event.publicationState === "draft" ||
      (event.publicationState === "withdrawn" && input.republish)) &&
    (willPublishOccurrence ||
      event?.editions.some((item) => item.publicationState === "published"))
  )
    add({ kind: "publishEvent", id: eventRef }, event?.version ?? 1);
  return result;
}

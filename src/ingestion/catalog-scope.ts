import { isDeepStrictEqual } from "node:util";
import type { CatalogOperation } from "@/catalog/operations/operation";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type { CatalogResearchInput } from "./contracts";
import type { ResearchCatalog } from "./research/context";
import type { ApplicationPlan } from "./proposals";
import { assignedGroups } from "./groups";
import { effectiveScope } from "./scope";
import { editionSlotNames } from "./research/contracts";

const editionFields: Record<string, string> = {
  editionYear: "year",
  startsOn: "dates",
  endsOn: "dates",
  dateState: "dates",
  venueName: "location",
  venueAddress: "location",
  locality: "location",
  administrativeArea: "location",
  countryCode: "location",
  latitude: "location",
  longitude: "location",
  coordinatePrecision: "location",
};

type SavedEvent = ResearchCatalog[number];
type BoundEdition = {
  slot: (typeof editionSlotNames)[number];
  editionKey: string;
  saved: SavedEvent["editions"][number] | undefined;
};
type Boundary = {
  event: SavedEvent | undefined;
  allowed: ReadonlySet<string>;
  editions: ReadonlyMap<string, BoundEdition>;
};

function requirePath(boundary: Boundary, path: string) {
  if (!boundary.allowed.has(path)) {
    throw new Error(`${path} is outside the assignment`);
  }
}

function requireEdition(boundary: Boundary, id: string) {
  const target = boundary.editions.get(id);
  if (!target) {
    throw new Error("Edition is outside the fixed targets");
  }
  return target;
}

function assertEventUpdate(
  op: Extract<CatalogOperation, { kind: "updateEvent" }>,
  boundary: Boundary,
) {
  if (op.id !== boundary.event?.id) {
    throw new Error("Event is outside the assignment");
  }
  for (const [field, value] of Object.entries(op.data)) {
    if (
      !isDeepStrictEqual(value, boundary.event?.[field as keyof SavedEvent])
    ) {
      requirePath(boundary, `event.fields.${field}`);
    }
  }
}

function assertEditionWrite(
  op: Extract<CatalogOperation, { kind: "createEdition" | "updateEdition" }>,
  boundary: Boundary,
) {
  const target = requireEdition(
    boundary,
    op.kind === "createEdition" ? `$${op.tempKey}` : op.id,
  );
  if (
    op.kind === "createEdition" &&
    (op.eventId !== boundary.event?.id ||
      op.data.editionKey !== target.editionKey)
  ) {
    throw new Error("Edition creation changed the fixed target");
  }
  for (const [field, value] of Object.entries(op.data)) {
    if (op.kind === "createEdition" && field === "editionKey") {
      continue;
    }
    if (
      !isDeepStrictEqual(
        value,
        target.saved?.[field as keyof NonNullable<BoundEdition["saved"]>],
      )
    ) {
      requirePath(
        boundary,
        `${target.slot}.fields.${editionFields[field] ?? field}`,
      );
    }
  }
}

type Links = Extract<CatalogOperation, { kind: "replaceLinks" }>["links"];
function linkValues(links: Links, kind: string) {
  return links
    .filter((link) => link.kind === kind)
    .map(({ url, label, official }) =>
      JSON.stringify([normalizeCatalogUrl(url), label ?? null, official]),
    )
    .sort((a, b) => a.localeCompare(b));
}

function linkPath(target: BoundEdition | null, kind: string) {
  if (target) {
    return `${target.slot}.fields.links.${kind === "ticketing" ? "tickets" : kind}`;
  }
  const field = kind === "official_site" ? "website" : `socials.${kind}`;
  return `event.fields.links.${field}`;
}

function assertLinks(
  op: Extract<CatalogOperation, { kind: "replaceLinks" }>,
  boundary: Boundary,
) {
  const target =
    op.owner.type === "event" ? null : requireEdition(boundary, op.owner.id);
  if (!target && op.owner.id !== boundary.event?.id) {
    throw new Error("Event is outside the assignment");
  }
  const previous = (target ? target.saved?.links : boundary.event?.links) ?? [];
  const kinds = new Set([...previous, ...op.links].map(({ kind }) => kind));
  for (const kind of kinds) {
    if (
      !isDeepStrictEqual(linkValues(previous, kind), linkValues(op.links, kind))
    ) {
      requirePath(boundary, linkPath(target, kind));
    }
  }
}

function assertOperation(op: CatalogOperation, boundary: Boundary) {
  switch (op.kind) {
    case "updateEvent":
      assertEventUpdate(op, boundary);
      break;
    case "createEdition":
    case "updateEdition":
      assertEditionWrite(op, boundary);
      break;
    case "replaceLinks":
      assertLinks(op, boundary);
      break;
    case "replaceTerms":
    case "replacePriceBlock": {
      const { slot } = requireEdition(boundary, op.id);
      requirePath(
        boundary,
        `${slot}.fields.${op.kind === "replaceTerms" ? "classification" : "tickets"}`,
      );
      break;
    }
    case "publishEdition":
      requireEdition(boundary, op.id);
      break;
    case "publishEvent":
      if (op.id !== boundary.event?.id || !boundary.editions.size) {
        throw new Error("Publication is outside the assigned Edition targets");
      }
      break;
    default:
      throw new Error(`${op.kind} is outside refresh scope`);
  }
}

/** Replacement operations retain sibling values. Check only their logical changes. */
export function assertCatalogScope(
  operations: CatalogOperation[],
  input: CatalogResearchInput,
  event: SavedEvent | undefined,
  plan: ApplicationPlan,
) {
  if (input.mode === "add") {
    return;
  }
  const editions = new Map<string, BoundEdition>();
  for (const slot of editionSlotNames) {
    const target = plan[slot];
    if (target) {
      const saved = event?.editions.find(
        ({ editionKey }) => editionKey === target.editionKey,
      );
      editions.set(saved?.id ?? `$edition_${slot}`, {
        slot,
        editionKey: target.editionKey,
        saved,
      });
    }
  }
  const boundary: Boundary = {
    event,
    editions,
    allowed: new Set(
      assignedGroups(effectiveScope(input), plan).map(({ path }) => path),
    ),
  };
  for (const op of operations) {
    assertOperation(op, boundary);
  }
}

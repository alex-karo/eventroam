import type { CatalogResearchInput } from "./contracts";
import {
  effectiveScope,
  normalizeScope,
  scopePath,
  type ScopeRequest,
} from "./scope";
import { editionSlotNames } from "./research/contracts";
import { generalFieldsSchema } from "./roles/general/contracts";
import { linksOutputSchema } from "./roles/links/contracts";

type EditionSlot = (typeof editionSlotNames)[number];
export type GroupOwner =
  "general" | "tickets" | "classification" | "links" | "location";
export type ProposalGroup = Readonly<
  {
    path: string;
    rawPath: string;
    temporal?: boolean;
  } & (
    | { owner: "location"; target: EditionSlot }
    | { owner: Exclude<GroupOwner, "location">; target: "event" | EditionSlot }
  )
>;
export type ReturnRequest = { group: ProposalGroup; note: string };
export const MAX_GROUP_RETURNS = 3;

const temporalFields = new Set(["year", "dates", "scheduleStatus"]);
const socials = linksOutputSchema.shape.event.shape.socials.shape;
const socialPath = "event.fields.links.socials.";

const eventGroups: ProposalGroup[] = [
  ...["description", "shortDescription"].map((field): ProposalGroup => ({
    owner: "classification",
    target: "event",
    path: `event.fields.${field}`,
    rawPath: field,
  })),
  {
    owner: "links",
    target: "event",
    path: "event.fields.links.website",
    rawPath: "event.website",
  },
  ...Object.keys(socials).map((field): ProposalGroup => ({
    owner: "links",
    target: "event",
    path: socialPath + field,
    rawPath: `event.socials.${field}`,
  })),
];

export function locationGroupPath(slot: EditionSlot) {
  return `${slot}.fields.location`;
}

function editionGroups(target: EditionSlot): ProposalGroup[] {
  const fields = `${target}.fields`;
  const groups: ProposalGroup[] = [
    ...Object.keys(generalFieldsSchema.shape).map((field): ProposalGroup => {
      const path = `${fields}.${field}`;
      return {
        owner: "general",
        target,
        path,
        rawPath: path,
        temporal: temporalFields.has(field),
      };
    }),
    {
      owner: "classification",
      target,
      path: `${fields}.classification`,
      rawPath: `${target}.classification`,
    },
    {
      owner: "location",
      target,
      path: locationGroupPath(target),
      rawPath: `decision.${target}`,
    },
  ];
  if (target === "currentOrNextEdition") {
    groups.push(
      {
        owner: "tickets",
        target,
        path: `${fields}.tickets`,
        rawPath: `${target}.tickets`,
      },
      {
        owner: "links",
        target,
        path: `${fields}.links.tickets`,
        rawPath: `${target}.tickets`,
      },
    );
  }
  return groups;
}

export const proposalGroups: readonly ProposalGroup[] = [
  ...eventGroups,
  ...editionSlotNames.flatMap(editionGroups),
];

export function proposalGroup(path: string) {
  return proposalGroups.find((group) => group.path === path);
}

export function fieldAssignments(scope: ScopeRequest | undefined) {
  const definition = typeof scope === "object" ? scope : normalizeScope(scope);
  return definition.tasks.flatMap((task) =>
    task.fields.map((field) => ({
      group: proposalGroup(scopePath(task.target, field))!,
      required: task.required ?? true,
      ...(task.instruction !== undefined && { instruction: task.instruction }),
    })),
  );
}

export function assignedGroups(
  scope: ScopeRequest | undefined,
  targets?: Record<EditionSlot, unknown>,
): ProposalGroup[] {
  const paths = new Set(fieldAssignments(scope).map(({ group }) => group.path));
  return proposalGroups.filter(
    ({ path, target }) =>
      paths.has(path) &&
      (!targets || target === "event" || Boolean(targets[target])),
  );
}

export function isAssigned(input: CatalogResearchInput, path: string) {
  return assignedGroups(effectiveScope(input)).some(
    (group) => group.path === path,
  );
}

export function isSocialLinkField(field: string) {
  return field.startsWith(socialPath) || Object.hasOwn(socials, field);
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function atPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((value, key) => record(value)?.[key], value);
}

export function setPath(value: unknown, path: string, replacement: unknown) {
  const parts = path.split(".");
  const key = parts.pop()!;
  let parent = record(value)!;
  for (const part of parts) {
    const next = record(parent[part]) ?? {};
    parent[part] = next;
    parent = next;
  }
  if (replacement === undefined) {
    delete parent[key];
  } else {
    parent[key] = replacement;
  }
}

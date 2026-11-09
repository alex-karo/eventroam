import type { CatalogResearchInput } from "./contracts";
import { editionSlotNames } from "./research/contracts";
import {
  generalFieldsSchema,
  linksOutputSchema,
  type Targets,
} from "./roles/contracts";

type EditionSlot = (typeof editionSlotNames)[number];
type Scope = CatalogResearchInput["scope"];

export type ProposalGroup = Readonly<
  {
    path: string;
    rawPath: string;
    temporal?: boolean;
  } & (
    | { owner: "location"; target: EditionSlot; check?: never }
    | {
        owner: "general" | "tickets" | "classification" | "links";
        target: "event" | EditionSlot;
        check: string;
      }
  )
>;
export type GroupOwner = ProposalGroup["owner"];

export const eventDescriptionFields = {
  description: true,
  shortDescription: true,
} as const;
export const generalCheckBySlot = {
  previousEdition: "previousCompletedEdition",
  currentOrNextEdition: "currentDates",
} as const;
export const eventLinksCheck = "eventLinks";
const temporalFields = new Set(["year", "dates", "scheduleStatus"]);
const socialFields = Object.keys(
  linksOutputSchema.shape.event.shape.socials.shape,
);
const socialPath = "event.fields.links.socials.";
const rawSocialPath = "event.socials";

const eventGroups: readonly ProposalGroup[] = [
  ...Object.keys(eventDescriptionFields).map((field): ProposalGroup => ({
    owner: "classification",
    target: "event",
    path: `event.fields.${field}`,
    rawPath: field,
    check: "description",
  })),
  {
    owner: "links",
    target: "event",
    path: "event.fields.links.website",
    rawPath: "event.website",
    check: eventLinksCheck,
  },
  ...socialFields.map((field): ProposalGroup => ({
    owner: "links",
    target: "event",
    path: socialPath + field,
    rawPath: `${rawSocialPath}.${field}`,
    check: eventLinksCheck,
  })),
];

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
        check: generalCheckBySlot[target],
        temporal: temporalFields.has(field),
      };
    }),
    {
      owner: "classification",
      target,
      path: `${fields}.classification`,
      rawPath: `${target}.classification`,
      check:
        target === "previousEdition"
          ? "previousClassification"
          : "currentClassification",
    },
    {
      owner: "location",
      target,
      path: `${fields}.location`,
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
        check: "currentTickets",
      },
      {
        owner: "links",
        target,
        path: `${fields}.links.tickets`,
        rawPath: `${target}.tickets`,
        check: "currentLinks",
      },
    );
  }
  return groups;
}

export const proposalGroups: readonly ProposalGroup[] = [
  ...eventGroups,
  ...editionSlotNames.flatMap(editionGroups),
];
const groupsByPath = new Map(
  proposalGroups.map((group) => [group.path, group]),
);
const eventChecks = new Set(eventGroups.map(({ check }) => check));

export function proposalGroup(path: string) {
  return groupsByPath.get(path);
}

export function proposalPermissions(scope: Scope) {
  const full = scope !== "current";
  return {
    eventFields: full,
    previousEdition: full,
    currentOrNextEdition: true,
  };
}

export function assignedGroups(
  scope: Scope,
  targets?: Pick<Targets, EditionSlot> | null,
): ProposalGroup[] {
  const { eventFields } = proposalPermissions(scope);
  // General uses the proposed slots to find field errors before validating the targets.
  return proposalGroups.filter(({ target }) =>
    target === "event" ? eventFields : Boolean(targets?.[target]),
  );
}

export function hasEventFieldCheck(checks: unknown) {
  return (
    Array.isArray(checks) &&
    checks.some((finding) => eventChecks.has(String(record(finding)?.check)))
  );
}

export function addressesEventFields(raw: unknown) {
  return (
    hasEventFieldCheck(atPath(raw, "checks")) ||
    eventGroups.some(({ rawPath }) => atPath(raw, rawPath)) ||
    Object.keys(record(atPath(raw, rawSocialPath)) ?? {}).length > 0
  );
}

export function isSocialLinkField(field: string) {
  return field.startsWith(socialPath) || socialFields.includes(field);
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

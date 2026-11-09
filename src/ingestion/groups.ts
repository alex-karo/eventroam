import type { CatalogResearchInput } from "./contracts";
import { editionSlotNames } from "./research/contracts";
import { generalFieldsSchema, type Targets } from "./roles/general/contracts";
import { linksOutputSchema } from "./roles/links/contracts";

export type GroupOwner =
  "general" | "tickets" | "classification" | "links" | "location";
export type ProposalGroup = {
  owner: GroupOwner;
  path: string;
  rawPath: string;
};

export function assignedGroups(
  scope: CatalogResearchInput["scope"],
  targets: Pick<Targets, "previousEdition" | "currentOrNextEdition">,
): ProposalGroup[] {
  const groups: ProposalGroup[] = [];
  const add = (owner: GroupOwner, path: string, rawPath: string) => {
    groups.push({ owner, path, rawPath });
  };
  if (scope !== "current") {
    for (const field of ["description", "shortDescription"]) {
      add("classification", `event.fields.${field}`, field);
    }
    add("links", "event.fields.links.website", "event.website");
    for (const field of Object.keys(
      linksOutputSchema.shape.event.shape.socials.shape,
    )) {
      add(
        "links",
        `event.fields.links.socials.${field}`,
        `event.socials.${field}`,
      );
    }
  }
  for (const slot of editionSlotNames) {
    if (!targets[slot]) {
      continue;
    }
    for (const field of Object.keys(generalFieldsSchema.shape)) {
      add("general", `${slot}.fields.${field}`, `${slot}.fields.${field}`);
    }
    add(
      "classification",
      `${slot}.fields.classification`,
      `${slot}.classification`,
    );
    add("location", `${slot}.fields.location`, `decision.${slot}`);
    if (slot === "currentOrNextEdition") {
      add("tickets", `${slot}.fields.tickets`, `${slot}.tickets`);
      add("links", `${slot}.fields.links.tickets`, `${slot}.tickets`);
    }
  }
  return groups;
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

import type { CatalogResearchInput } from "../contracts";
import type { FrozenCorpus } from "../evidence/contracts";
import {
  atPath,
  isEventFieldCheck,
  record,
  type GroupOwner,
  type ProposalGroup,
} from "../groups";
import type { ResearchError } from "../research/contracts";
import type { ResearchContext } from "../research/context";
import type { Targets } from "./general/contracts";
import type { RoleConversation } from "./invoke";
import type { LocationValidationContext } from "./location/group-validation";

export type Reply = Pick<RoleConversation, "raw" | "schema">;
export type GroupIssue = { group: ProposalGroup; rule: string };
export type ProposalValidationContext = {
  corpus: FrozenCorpus;
  targets: Targets | null;
  context: ResearchContext;
  input: CatalogResearchInput;
  location?: LocationValidationContext;
};

export class RepairFailure extends Error {
  constructor(readonly diagnostic: ResearchError) {
    super(diagnostic.message);
  }
}

export function failProposal(
  message: string,
  field?: string,
  code: ResearchError["code"] = "invalid_candidate",
): never {
  throw new RepairFailure({
    code,
    stage: code === "location_failed" ? "location" : "validation",
    message,
    ...(field && { field }),
  });
}

export function failGroupIssue({ group, rule }: GroupIssue): never {
  const code = {
    general: "invalid_candidate",
    tickets: "invalid_candidate",
    links: "invalid_candidate",
    classification: "invalid_plan",
    location: "location_failed",
  } as const;
  failProposal(rule, group.path, code[group.owner]);
}

export function replyReferences(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => replyReferences(entry, key));
  }
  return Object.entries(record(value) ?? {}).flatMap(([name, entry]) => {
    if (name === key) {
      return Array.isArray(entry) ? entry : [entry];
    }
    return replyReferences(entry, key);
  });
}

export function selectedEvent(ctx: ProposalValidationContext) {
  return ctx.context.catalog.find(
    ({ id }) => id === (ctx.input.eventId ?? ctx.targets?.eventId),
  );
}

export function requireKnownReferences(
  owner: GroupOwner,
  raw: unknown,
  key: string,
  ids: readonly string[],
  description: string,
) {
  if (
    replyReferences(raw, key).some(
      (id) => typeof id !== "string" || !ids.includes(id),
    )
  ) {
    failProposal(
      `${owner}: unknown ${description} reference`,
      undefined,
      owner === "location" ? "location_failed" : "invalid_candidate",
    );
  }
}

function requireAssignedEventFields(
  owner: GroupOwner,
  raw: unknown,
  ctx: ProposalValidationContext,
) {
  if (ctx.input.scope !== "current") {
    return;
  }
  const checks = atPath(raw, "checks");
  const eventCheck =
    Array.isArray(checks) &&
    checks.some((finding) => isEventFieldCheck(String(record(finding)?.check)));
  if (
    eventCheck ||
    atPath(raw, "description") ||
    atPath(raw, "shortDescription") ||
    atPath(raw, "event.website") ||
    Object.keys(record(atPath(raw, "event.socials")) ?? {}).length
  ) {
    failProposal(`${owner}: Event fields are outside the assignment`);
  }
}

export type GroupValidationInput = {
  reply: Reply;
  groups: ProposalGroup[];
  ctx: ProposalValidationContext;
  only?: ReadonlySet<string>;
  returnedPaths?: ReadonlySet<string>;
};

export function missingChangeEvidence(
  group: ProposalGroup,
  { reply, returnedPaths }: GroupValidationInput,
) {
  const change = record(atPath(reply.raw, group.rawPath));
  if (
    !returnedPaths?.has(group.path) &&
    ["set", "clear"].includes(String(change?.action)) &&
    Array.isArray(change?.evidenceIds) &&
    change.evidenceIds.length === 0
  ) {
    return "Missing evidence reference. Cite a supplied passage that supports the change.";
  }
}

export function checkGroups(
  owner: GroupOwner,
  options: GroupValidationInput,
  checkGroup: (group: ProposalGroup) => string | undefined = (group) =>
    missingChangeEvidence(group, options),
  checkBoundary?: () => void,
) {
  const { reply, groups, only } = options;
  const parsed = reply.schema.safeParse(reply.raw);
  const issues = (parsed.error?.issues ?? []).map<GroupIssue>((issue) => {
    const path = issue.path.join(".");
    const group = groups.find(
      ({ rawPath }) => path === rawPath || path.startsWith(rawPath + "."),
    );
    if (!group) {
      failProposal(
        owner === "location"
          ? `${path}:${issue.code}`
          : `${owner}: ${path}:${issue.code}`,
        undefined,
        owner === "location" ? "location_failed" : "invalid_candidate",
      );
    }
    return { group, rule: `${path}:${issue.code} ${issue.message}` };
  });
  checkBoundary?.();
  for (const group of groups) {
    if (
      (only && !only.has(group.path)) ||
      issues.some((i) => i.group === group)
    ) {
      continue;
    }
    const rule = checkGroup(group);
    if (rule) {
      issues.push({ group, rule });
    }
  }
  return {
    parsed,
    issues: only ? issues.filter(({ group }) => only.has(group.path)) : issues,
  };
}

export function validateProposalBoundary(
  owner: GroupOwner,
  { reply, ctx }: GroupValidationInput,
) {
  requireKnownReferences(
    owner,
    reply.raw,
    "evidenceIds",
    ctx.corpus.evidence.map(({ id }) => id),
    "evidence",
  );
  requireKnownReferences(
    owner,
    reply.raw,
    "sourceIds",
    ctx.corpus.sources.map(({ id }) => id),
    "source",
  );
  if (owner !== "general") {
    requireAssignedEventFields(owner, reply.raw, ctx);
  }
}

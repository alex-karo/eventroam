import type { PreparedProposals } from "../../proposals";
import {
  atPath,
  MAX_GROUP_RETURNS,
  proposalGroups,
  type GroupOwner,
  type ProposalGroup,
  type ReturnRequest,
} from "../../groups";
import { editionSlotNames } from "../../research/contracts";
import type { ReviewDecisions, ReviewPath } from "./contracts";

export function groupProposal(
  prepared: PreparedProposals,
  group: ProposalGroup,
) {
  return group.owner === "location"
    ? prepared.location.slots[group.target]
    : atPath(prepared.plan, group.path);
}

export function reviewPaths(
  prepared: PreparedProposals,
  groups: ProposalGroup[],
  returnCounts: ReadonlyMap<string, number>,
  canReturn: (owner: GroupOwner) => boolean,
  targeted?: ReadonlySet<string>,
): ReviewPath[] {
  const choices: ReviewPath[] = [];
  const add = (
    path: string,
    required: boolean,
    allowed: ReviewPath["allowed"],
  ) => choices.push({ path, required, allowed });
  if (!targeted) {
    add("item", true, ["approve", "reject"]);
    add("event.target", true, ["approve", "reject"]);
    for (const slot of editionSlotNames) {
      if (prepared.plan[slot]) {
        add(`${slot}.target`, true, ["approve", "reject"]);
      }
    }
  }
  for (const group of groups) {
    const { path, owner } = group;
    if (targeted && !targeted.has(path)) {
      continue;
    }
    const count = returnCounts.get(path) ?? 0;
    const required =
      !!targeted || count > 0 || groupProposal(prepared, group) !== undefined;
    const allowed: ReviewPath["allowed"] = required
      ? ["approve", "reject"]
      : [];
    if (count < MAX_GROUP_RETURNS && canReturn(owner)) {
      allowed.push("return");
    }
    if (allowed.length) {
      add(path, required, allowed);
    }
  }
  return choices;
}
export function rejectedItem(review: ReviewDecisions) {
  return [review.get("item"), review.get("event.target")].find(
    (entry) => entry?.decision === "reject",
  );
}

export function rejectedEdition(
  review: ReviewDecisions,
  slot: (typeof editionSlotNames)[number],
) {
  return (
    review.get(`${slot}.target`)?.decision === "reject" ||
    proposalGroups.some(
      ({ target, temporal, path }) =>
        target === slot && temporal && review.get(path)?.decision === "reject",
    )
  );
}

export function reviewReturns(
  review: ReviewDecisions,
  groups: readonly ProposalGroup[],
): ReturnRequest[] {
  if (rejectedItem(review)) {
    return [];
  }
  const requests: ReturnRequest[] = [];
  for (const { decision, path, note } of review.values()) {
    if (decision !== "return") {
      continue;
    }
    const group = groups.find((group) => group.path === path);
    if (
      group &&
      (group.target === "event" || !rejectedEdition(review, group.target))
    ) {
      requests.push({ group, note });
    }
  }
  return requests;
}

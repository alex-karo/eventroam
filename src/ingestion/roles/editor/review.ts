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
import type { ReviewDecisions, ReviewScope } from "./contracts";

export function groupProposal(
  prepared: PreparedProposals,
  group: ProposalGroup,
) {
  return group.owner === "location"
    ? prepared.location.slots[group.target]
    : atPath(prepared.plan, group.path);
}

export function reviewScope(
  prepared: PreparedProposals,
  groups: readonly ProposalGroup[],
  returnCounts: ReadonlyMap<string, number>,
  canReturn: (owner: GroupOwner) => boolean,
  targeted = false,
): ReviewScope {
  const reviewPaths: ReviewScope["reviewPaths"] = [];
  const missingGroups: string[] = [];
  if (!targeted) {
    reviewPaths.push(
      { path: "item", allowed: ["approve", "reject"] },
      { path: "event.target", allowed: ["approve", "reject"] },
    );
    for (const slot of editionSlotNames) {
      if (prepared.plan[slot]) {
        reviewPaths.push({
          path: `${slot}.target`,
          allowed: ["approve", "reject"],
        });
      }
    }
  }
  for (const group of groups) {
    const { path, owner } = group;
    const count = returnCounts.get(path) ?? 0;
    const required =
      targeted || count > 0 || groupProposal(prepared, group) !== undefined;
    const canReturnGroup = count < MAX_GROUP_RETURNS && canReturn(owner);
    if (required) {
      reviewPaths.push({
        path,
        allowed: ["approve", canReturnGroup ? "return" : "reject"],
      });
    } else if (canReturnGroup) {
      missingGroups.push(path);
    }
  }
  return { reviewPaths, missingGroups };
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

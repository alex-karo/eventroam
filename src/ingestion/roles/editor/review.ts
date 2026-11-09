import type { PreparedProposals } from "../../proposals";
import { atPath, type GroupOwner, type ProposalGroup } from "../../groups";
import { editionSlotNames } from "../../research/contracts";
import type { ReviewDecisions, ReviewPath } from "./contracts";

export const MAX_GROUP_RETURNS = 3;
export function groupProposal(prepared: PreparedProposals, path: string) {
  return path.endsWith(".fields.location")
    ? atPath(prepared.location.slots, path.split(".")[0])
    : atPath(prepared.plan, path);
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
  for (const { path, owner } of groups) {
    if (targeted && !targeted.has(path)) {
      continue;
    }
    const count = returnCounts.get(path) ?? 0;
    const required =
      !!targeted || count > 0 || groupProposal(prepared, path) !== undefined;
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

export function rejectedEdition(review: ReviewDecisions, slot: string) {
  return [
    "target",
    "fields.dates",
    "fields.year",
    "fields.scheduleStatus",
  ].some((field) => review.get(`${slot}.${field}`)?.decision === "reject");
}

export function reviewReturns(review: ReviewDecisions) {
  if (rejectedItem(review)) {
    return [];
  }
  return [...review.values()].filter(
    ({ decision, path }) =>
      decision === "return" && !rejectedEdition(review, path.split(".")[0]),
  );
}

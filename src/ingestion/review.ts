import { z } from "zod";
import type { PreparedProposals } from "./proposals";
import { atPath, type GroupOwner, type ProposalGroup } from "./groups";
import { editionSlotNames } from "./research/contracts";

export const reviewOutput = z.strictObject({
  decisions: z.array(
    z.strictObject({
      path: z.string(),
      decision: z.enum(["approve", "reject", "return"]),
      note: z
        .string()
        .refine((note) => note.trim().length > 0, "Use a nonblank note"),
    }),
  ),
});
export type ReviewDecision = z.infer<typeof reviewOutput>["decisions"][number];
export type ReviewDecisions = Map<string, ReviewDecision>;
export const MAX_GROUP_RETURNS = 3;

export type ReviewPath = {
  path: string;
  required: boolean;
  allowed: ReviewDecision["decision"][];
};

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

export function reviewSchema(paths: ReviewPath[]) {
  const byPath = new Map(paths.map((entry) => [entry.path, entry]));
  return reviewOutput.superRefine(({ decisions }, ctx) => {
    const seen = new Set<string>();
    for (const [index, { path, decision }] of decisions.entries()) {
      if (seen.has(path) || !byPath.get(path)?.allowed.includes(decision)) {
        ctx.addIssue({
          code: "custom",
          path: ["decisions", index],
          message: "Duplicate path or disallowed decision",
        });
      }
      seen.add(path);
    }
    for (const entry of paths) {
      if (entry.required && !seen.has(entry.path)) {
        ctx.addIssue({
          code: "custom",
          path: ["decisions"],
          message: `Missing decision for ${entry.path}`,
        });
      }
    }
  });
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

import { normalizeProposedAssignments } from "@/catalog/domain/classification";
import { requireSupport, type FrozenCorpus } from "../../evidence/contracts";
import { atPath, type ProposalGroup } from "../../groups";
import { editionSlotNames } from "../../research/contracts";
import { earlierEdition, proposedChronology } from "../../research/guards";
import type { ResearchContext } from "../../research/context";
import type { Targets } from "../general/contracts";
import {
  checkGroups,
  validateProposalBoundary,
  type GroupValidationInput,
  failProposal,
  missingChangeEvidence,
  selectedEvent,
} from "../proposal-validation";
import type { ClassificationOutput } from "./contracts";

type SavedEvent = ResearchContext["catalog"][number];
type Slot = (typeof editionSlotNames)[number];
export function checkedClassification(
  target: Pick<
    NonNullable<Targets["currentOrNextEdition"]>,
    "editionKey" | "fields"
  >,
  classification: NonNullable<
    NonNullable<ClassificationOutput["currentOrNextEdition"]>["classification"]
  >,
  event: SavedEvent | undefined,
  context: ResearchContext,
  corpus: FrozenCorpus,
) {
  const saved = event?.editions.find(
    (edition) => edition.editionKey === target.editionKey,
  );
  const retained = new Set(saved?.terms.map((term) => term.id) ?? []);
  if (classification.reuseFrom) {
    const earlier = event?.editions.find(
      (edition) => edition.editionKey === classification.reuseFrom!.editionKey,
    );
    const chronology = proposedChronology(target, saved);
    if (!earlierEdition(earlier, chronology)) {
      throw new Error("Invalid classification reuse Edition");
    }
    requireSupport(classification.evidenceIds, corpus);
  } else if (
    classification.value.some((id) => !retained.has(id)) ||
    [...retained].some((id) => !classification.value.includes(id))
  ) {
    requireSupport(classification.evidenceIds, corpus);
  }
  const { retained: termIds, removed } = normalizeProposedAssignments(
    classification.value,
    context.terms,
  );
  const normalization = removed.length
    ? ` Removed selected ancestor terms ${removed.join(", ")}; retained descendant terms ${termIds.join(", ")}.`
    : "";
  return {
    ...classification,
    reason: classification.reason + normalization,
    value: termIds,
  };
}
type ClassificationChange = NonNullable<
  NonNullable<ClassificationOutput[Slot]>["classification"]
>;

function classificationGroupRule(
  group: ProposalGroup,
  { reply, ctx, available }: GroupValidationInput,
) {
  const slot = editionSlotNames.find((slot) =>
    group.path.startsWith(slot + "."),
  );
  if (!slot) {
    return missingChangeEvidence(reply.raw, group);
  }
  const target = ctx.targets?.[slot];
  const change = atPath(reply.raw, group.rawPath) as
    ClassificationChange | undefined;
  if (!target || !change) {
    return;
  }
  const event = selectedEvent(ctx);
  const unknownTerms = change.value.filter(
    (id) => !ctx.context.terms.some((term) => term.id === id),
  );
  const donorKey = change.reuseFrom?.editionKey;
  const errors: string[] = [];
  if (unknownTerms.length) {
    errors.push(
      `Unknown classification term IDs ${JSON.stringify(unknownTerms)}. Use only term IDs from the supplied vocabulary.`,
    );
  }
  if (
    donorKey &&
    !event?.editions.some((edition) => edition.editionKey === donorKey)
  ) {
    errors.push(
      `Unknown classification reuse Edition ${JSON.stringify(donorKey)}. Use an applicable earlier saved Edition of this Event or omit reuse when the current evidence supports the classification.`,
    );
  }
  if (errors.length) {
    return `${errors.join(" ")} If there is no supported classification, omit the group with a reason.`;
  }
  try {
    checkedClassification(target, change, event, ctx.context, {
      ...ctx.corpus,
      evidence: available,
    });
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Invalid classification group";
  }
}

export function validateClassificationReply(options: GroupValidationInput) {
  validateProposalBoundary("classification", options);
  if (
    editionSlotNames.some(
      (slot) =>
        !options.ctx.targets?.[slot] &&
        atPath(options.reply.raw, `${slot}.classification`) != null,
    )
  ) {
    failProposal("Classification proposal for an absent target");
  }
  return checkGroups("classification", options, (group) =>
    classificationGroupRule(group, options),
  );
}

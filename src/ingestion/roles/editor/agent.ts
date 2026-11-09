import {
  evidencePacket,
  topics,
  type Evidence,
} from "../../evidence/contracts";
import { savedPages, savedSearchInstructions } from "../../evidence/repair";
import type { PreparedProposals } from "../../proposals";
import type { RepairRecord } from "../../repairs";
import { editionSlotNames } from "../../research/contracts";
import { buildAssignment } from "../assignment";
import { invokeRole, roleInputCharacterLimit } from "../invoke";
import { roleInvocationOptions, type RoleOptions } from "../options";
import { PROMPT_VERSIONS } from "../versions";
import type { ReviewPath } from "./contracts";
import { editorInstructions } from "./prompt";
import { groupProposal } from "./review";
import { reviewSchema, validateEditorReply } from "./validate";

export async function runEditor(
  options: RoleOptions,
  prepared: PreparedProposals,
  paths: ReviewPath[],
  repairs: RepairRecord[],
  targeted = false,
) {
  const { sourceFiles, tools } = await savedPages(
    options.corpus,
    options.signal,
  );
  const { evidence: proposalEvidence, ...basis } = prepared.basis;
  const repairEvidence = repairs.flatMap(({ evidence }) => evidence ?? []);
  const cited = new Set(repairEvidence.map(({ id }) => id));
  const returnedGroups = targeted
    ? paths.map(({ path }) => {
        const slot = editionSlotNames.find(
          (slot) => path === `${slot}.fields.location`,
        );
        const evidenceIds = slot ? prepared.location.support[slot] : undefined;
        for (const id of evidenceIds ?? []) {
          cited.add(id);
        }
        return {
          path,
          proposal: groupProposal(prepared, path) ?? null,
          ...(evidenceIds?.length && { evidenceIds }),
        };
      })
    : undefined;
  const currentEvidence = new Map(
    proposalEvidence
      .filter(({ id }) => !targeted || cited.has(id))
      .map((item) => [item.id, item]),
  );
  const earlierEvidence = new Map<string, Evidence>();
  for (const item of repairEvidence) {
    if (!currentEvidence.has(item.id)) {
      earlierEvidence.set(item.id, item);
    }
  }
  const schema = reviewSchema(paths);
  return invokeRole({
    ...roleInvocationOptions(options, "editor"),
    role: "editor",
    version: PROMPT_VERSIONS.editor,
    instructions:
      editorInstructions +
      "\n" +
      savedSearchInstructions +
      (targeted
        ? "\nThis is a targeted review. The proposals are in returnedGroups. Use fixedEditions only as context. Do not review any other group or target."
        : ""),
    input: {
      currentDate: options.context.currentDate,
      permissions: buildAssignment(options.input, options.context).permissions,
      sourceFiles,
      reviewPaths: paths,
      repairs: repairs.map(({ evidence, ...repair }) => ({
        ...repair,
        ...(evidence && { evidenceIds: evidence.map(({ id }) => id) }),
      })),
      ...(targeted && {
        returnedGroups,
        fixedEditions: {
          previousEdition: prepared.targets.previousEdition,
          currentOrNextEdition: prepared.targets.currentOrNextEdition,
        },
      }),
      vocabulary: options.context.terms,
      prepared: {
        ...(!targeted && { plan: prepared.plan, location: prepared.location }),
        unresolved: prepared.unresolved,
        identity: {
          eventId: prepared.targets.eventId,
          observedEventName: prepared.targets.observedEventName,
          reason: prepared.targets.reason,
          evidenceIds: prepared.targets.evidenceIds,
        },
        basis,
      },
      evidence: [
        ...evidencePacket(
          { ...options.corpus, evidence: [...currentEvidence.values()] },
          topics,
          { anchors: true },
        ).evidence,
        // Earlier repair passages count toward the full role input limit.
        ...evidencePacket(
          { ...options.corpus, evidence: [...earlierEvidence.values()] },
          topics,
          { anchors: true, maxCharacters: roleInputCharacterLimit },
        ).evidence,
      ],
    },
    schema,
    validateReply: (reply) => validateEditorReply(schema, reply),
    tools,
    steps: 6,
  });
}

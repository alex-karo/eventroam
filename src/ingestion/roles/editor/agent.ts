import { evidencePacket, topics } from "../../evidence/contracts";
import { savedPages, savedSearchInstructions } from "../../evidence/repair";
import type { ProposalGroup } from "../../groups";
import type { PreparedProposals } from "../../proposals";
import type { RepairRecord } from "../../repairs";
import { buildAssignment } from "../assignment";
import { invokeRole } from "../invoke";
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
  targetedGroups?: readonly ProposalGroup[],
) {
  const { sourceFiles, tools } = await savedPages(
    options.corpus,
    options.signal,
  );
  const cited = new Set(
    repairs.flatMap(({ evidence }) => evidence?.map(({ id }) => id) ?? []),
  );
  const returnedGroups = [];
  for (const group of targetedGroups ?? []) {
    if (group.owner === "location") {
      for (const id of prepared.location.support[group.target] ?? []) {
        cited.add(id);
      }
    }
    returnedGroups.push({
      path: group.path,
      proposal: groupProposal(prepared, group) ?? null,
    });
  }
  const evidence = targetedGroups
    ? prepared.basis.evidence.filter(({ id }) => cited.has(id))
    : prepared.basis.evidence;
  const schema = reviewSchema(paths);
  return invokeRole({
    ...roleInvocationOptions(options, "editor"),
    role: "editor",
    version: PROMPT_VERSIONS.editor,
    instructions:
      editorInstructions +
      "\n" +
      savedSearchInstructions +
      (targetedGroups
        ? "\nThis is a targeted review. The proposals are in returnedGroups. Use fixedEditions only as context. Do not review any other group or target."
        : ""),
    input: {
      currentDate: options.context.currentDate,
      permissions: buildAssignment(options.input, options.context).permissions,
      sourceFiles,
      reviewPaths: paths,
      repairs,
      ...(targetedGroups && {
        returnedGroups,
        fixedEditions: {
          previousEdition: prepared.targets.previousEdition,
          currentOrNextEdition: prepared.targets.currentOrNextEdition,
        },
      }),
      vocabulary: options.context.terms,
      prepared: {
        ...(!targetedGroups && {
          plan: prepared.plan,
          location: prepared.location,
        }),
        unresolved: prepared.unresolved,
        identity: {
          eventId: prepared.targets.eventId,
          observedEventName: prepared.targets.observedEventName,
          reason: prepared.targets.reason,
          evidenceIds: prepared.targets.evidenceIds,
        },
        basis: {
          ...prepared.basis,
          evidence: evidencePacket({ ...options.corpus, evidence }, topics, {
            anchors: true,
          }).evidence,
        },
      },
    },
    schema,
    validateReply: (reply) => validateEditorReply(schema, reply),
    tools,
    steps: 6,
  });
}

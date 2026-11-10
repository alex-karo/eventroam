import { evidencePacket, topics } from "../../evidence/contracts";
import { savedPages } from "../../evidence/saved-pages";
import type { ProposalGroup } from "../../groups";
import type { PreparedProposals } from "../../proposals";
import type { RepairRecord } from "../../repairs";
import { buildAssignment } from "../assignment";
import { invokeRole } from "../invoke";
import { roleInvocationOptions, type RoleOptions } from "../options";
import { replyReferences } from "../proposal-validation";
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
  const { evidence: proposalEvidence, ...basis } = prepared.basis;
  const cited = new Set([
    ...(targetedGroups ? [] : proposalEvidence.map(({ id }) => id)),
    ...repairs.flatMap(({ original, evidence }) => [
      ...replyReferences(original, "evidenceIds"),
      ...(evidence?.map(({ id }) => id) ?? []),
    ]),
  ]);
  const returnedGroups = [];
  for (const group of targetedGroups ?? []) {
    const evidenceIds =
      group.owner === "location"
        ? prepared.location.support[group.target]
        : undefined;
    for (const id of evidenceIds ?? []) {
      cited.add(id);
    }
    returnedGroups.push({
      path: group.path,
      proposal: groupProposal(prepared, group) ?? null,
      ...(evidenceIds?.length && { evidenceIds }),
    });
  }
  const evidence = options.corpus.evidence.filter(({ id }) => cited.has(id));
  const schema = reviewSchema(paths);
  const needsVocabulary =
    !targetedGroups ||
    targetedGroups.some(({ owner }) => owner === "classification");
  return invokeRole({
    ...roleInvocationOptions(options, "editor"),
    role: "editor",
    version: PROMPT_VERSIONS.editor,
    instructions:
      editorInstructions +
      (targetedGroups
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
      ...(targetedGroups && {
        returnedGroups,
        fixedEditions: {
          previousEdition: prepared.targets.previousEdition,
          currentOrNextEdition: prepared.targets.currentOrNextEdition,
        },
      }),
      ...(needsVocabulary && { vocabulary: options.context.terms }),
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
        basis,
      },
      evidence: evidencePacket({ ...options.corpus, evidence }, topics, {
        anchors: true,
        includeSourceUrl: false,
      }).evidence,
    },
    schema,
    validateReply: (reply) => validateEditorReply(schema, reply),
    tools,
    steps: 6,
  });
}

import {
  evidencePacket,
  topics,
  type FrozenCorpus,
} from "../../evidence/contracts";
import { savedPages } from "../../evidence/saved-pages";
import { proposalGroup, type ProposalGroup } from "../../groups";
import type { PreparedProposals } from "../../proposals";
import type { RepairRecord } from "../../repairs";
import { assignmentPermissions, refreshScope } from "../assignment";
import { invokeRole, type RoleExecution } from "../invoke";
import { roleInvocationOptions, type RoleOptions } from "../options";
import { replyReferences } from "../proposal-validation";
import { PROMPT_VERSIONS } from "../versions";
import type { ReviewOutput, ReviewScope } from "./contracts";
import { editorInstructions } from "./prompt";
import { groupProposal } from "./review";
import { editorReplySchema, validateEditorReply } from "./validate";

function selectReviewEvidence(
  corpus: FrozenCorpus,
  cited: ReadonlySet<unknown>,
  scope: ReviewScope,
) {
  const reviewsProgramme = [
    ...scope.reviewPaths.map(({ path }) => path),
    ...scope.missingGroups,
  ].some((path) => proposalGroup(path)?.owner === "classification");
  const evidence = corpus.evidence.filter(
    (item) =>
      cited.has(item.id) ||
      (reviewsProgramme &&
        (item.topics.includes("classification") ||
          item.topics.includes("description"))),
  );
  return evidencePacket({ ...corpus, evidence }, topics, {
    anchors: true,
    includeSourceUrl: false,
  }).evidence;
}

export async function runEditor(
  options: RoleOptions,
  prepared: PreparedProposals,
  scope: ReviewScope,
  repairs: RepairRecord[],
  targetedGroups?: readonly ProposalGroup[],
): Promise<RoleExecution<ReviewOutput>> {
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
  const schema = editorReplySchema(scope);
  const needsVocabulary =
    !targetedGroups ||
    targetedGroups.some(({ owner }) => owner === "classification");
  const { output: reply, ...execution } = await invokeRole({
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
      permissions: assignmentPermissions(refreshScope(options.input)),
      sourceFiles,
      ...scope,
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
      evidence: selectReviewEvidence(options.corpus, cited, scope),
    },
    schema,
    validateReply: (reply) => validateEditorReply(schema, reply),
    tools,
    steps: 6,
  });
  if (!reply) {
    return execution;
  }
  const output: ReviewOutput = {
    decisions: [
      ...Object.entries(reply.decisions).map(([path, decision]) => ({
        path,
        ...decision,
      })),
      ...(reply.missingReturns ?? []).map((request) => ({
        ...request,
        decision: "return" as const,
      })),
    ],
  };
  return {
    ...execution,
    output,
    modelResponse: {
      text: execution.modelResponse?.text ?? null,
      object: output,
    },
  };
}

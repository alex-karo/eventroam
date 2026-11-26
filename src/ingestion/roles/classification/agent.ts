import { evidencePacket } from "../../evidence/contracts";
import { assignmentPermissions, specialistChecks } from "../assignment";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole, type RoleExecution } from "../invoke";
import { z } from "zod";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleRuntimeOptions,
  type SpecialistContext,
  type TargetContextSelection,
  type SavedEdition,
} from "../options";
import {
  classificationReplySchema,
  type ClassificationOutput,
} from "./contracts";
import {
  CLASSIFICATION_PROMPT_VERSION,
  getClassificationInstructions,
} from "./prompt";
import {
  classificationVocabulary,
  materializeClassificationReply,
} from "./terms";

function classificationHistory(edition: SavedEdition) {
  return {
    ...editionChronology(edition),
    terms: edition.terms.map(({ facet, slug }) => ({ facet, slug })),
  };
}
type ClassificationInput = Pick<
  SpecialistContext,
  | "corpus"
  | "savedEvent"
  | "savedEditions"
  | "currentDate"
  | "terms"
  | "groups"
  | "scope"
> & {
  targets: TargetContextSelection;
};

export async function runClassification(
  options: RoleRuntimeOptions,
  {
    corpus,
    targets,
    groups,
    scope,
    savedEvent: saved,
    savedEditions,
    currentDate,
    terms,
  }: ClassificationInput,
): Promise<RoleExecution<ClassificationOutput>> {
  const describeFestival = assignmentPermissions(scope).eventFields;
  const output = describeFestival
    ? classificationReplySchema
    : classificationReplySchema.omit({
        description: true,
        shortDescription: true,
      });
  const { output: reply, ...execution } = await invokeRole({
    ...roleInvocationOptions(options, "classification"),
    role: "classification",
    version: CLASSIFICATION_PROMPT_VERSION,
    instructions: getClassificationInstructions(describeFestival),
    input: {
      assignedChecks: specialistChecks("classification", groups),
      targets: targetContext(
        targets,
        savedEditions,
        currentDate,
        classificationHistory,
      ),
      history: saved?.editions.map(classificationHistory),
      ...(describeFestival && {
        savedDescriptions: {
          description: saved?.description ?? null,
          shortDescription: saved?.shortDescription ?? null,
        },
      }),
      vocabulary: classificationVocabulary(terms),
      corpus: evidencePacket(
        corpus,
        describeFestival
          ? [...roleEvidenceTopics.classification, "location"]
          : roleEvidenceTopics.classification,
      ),
    },
    schema: output.extend({
      previousEdition: targets.previousEdition
        ? classificationReplySchema.shape.previousEdition
        : z.null(),
      currentOrNextEdition: targets.currentOrNextEdition
        ? classificationReplySchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
  if (!reply) {
    return execution;
  }
  try {
    return {
      ...execution,
      output: materializeClassificationReply(reply, savedEditions, terms),
    };
  } catch (error) {
    return {
      ...execution,
      status: "failed",
      errors: [
        {
          code: "invalid_candidate",
          stage: "research",
          message:
            error instanceof Error ? error.message : "Invalid classification",
        },
      ],
    };
  }
}

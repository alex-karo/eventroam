import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole, type RoleExecution } from "../invoke";
import { returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import { z } from "zod";
import { assignedRoleChecks } from "../assignment";
import type { Targets } from "../general/contracts";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleOptions,
  type SavedEdition,
} from "../options";
import {
  classificationReplySchema,
  type ClassificationOutput,
} from "./contracts";
import { classificationInstructions, descriptionInstructions } from "./prompt";
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
export async function runClassification(
  options: RoleOptions,
  targets: Targets,
): Promise<RoleExecution<ClassificationOutput>> {
  const describeFestival = options.input.scope !== "current";
  const { terms } = options.context;
  const saved = options.context.catalog.find(
    (event) => event.id === (options.input.eventId ?? targets.eventId),
  );
  const output = describeFestival
    ? classificationReplySchema
    : classificationReplySchema.omit({
        description: true,
        shortDescription: true,
      });
  const { output: reply, ...execution } = await invokeRole({
    ...roleInvocationOptions(options, "classification"),
    role: "classification",
    version: PROMPT_VERSIONS.classification,
    instructions:
      (describeFestival
        ? descriptionInstructions + "\n" + classificationInstructions
        : classificationInstructions) + returnInstructions,
    input: {
      assignedChecks: assignedRoleChecks(
        "classification",
        options.input,
        targets,
      ),
      targets: targetContext(options, targets, classificationHistory),
      history: saved?.editions.map(classificationHistory),
      ...(describeFestival && {
        savedDescriptions: {
          description: saved?.description ?? null,
          shortDescription: saved?.shortDescription ?? null,
        },
      }),
      vocabulary: classificationVocabulary(terms),
      corpus: evidencePacket(
        options.corpus,
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
      output: materializeClassificationReply(reply, targets, saved, terms),
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

import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole, type RoleExecution } from "../invoke";
import { boundary, returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import { z } from "zod";
import { assignedRoleChecks } from "../assignment";
import { assignedGroups, isAssigned } from "../../groups";
import { effectiveScope } from "../../scope";
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
  const groups = assignedGroups(effectiveScope(options.input), targets).filter(
    ({ owner }) => owner === "classification",
  );
  const describeFestival = groups.some(({ target }) => target === "event");
  const classify = groups.some(({ target }) => target !== "event");
  const { terms } = options.context;
  const saved = options.context.catalog.find(
    (event) => event.id === (options.input.eventId ?? targets.eventId),
  );
  const output = classificationReplySchema.pick({
    ...(isAssigned(options.input, "event.fields.description") && {
      description: true,
    }),
    ...(isAssigned(options.input, "event.fields.shortDescription") && {
      shortDescription: true,
    }),
    checks: true,
    unresolved: true,
  });
  const roleTargets = {
    ...targets,
    previousEdition: groups.some(({ target }) => target === "previousEdition")
      ? targets.previousEdition
      : null,
    currentOrNextEdition: groups.some(
      ({ target }) => target === "currentOrNextEdition",
    )
      ? targets.currentOrNextEdition
      : null,
  };
  const { output: reply, ...execution } = await invokeRole({
    ...roleInvocationOptions(options, "classification"),
    role: "classification",
    version: PROMPT_VERSIONS.classification,
    instructions:
      (describeFestival ? descriptionInstructions : "") +
      (classify ? "\n" + classificationInstructions : "") +
      "\n" +
      boundary +
      returnInstructions,
    input: {
      scope: effectiveScope(options.input),
      assignedChecks: assignedRoleChecks(
        "classification",
        options.input,
        targets,
      ),
      targets: targetContext(options, roleTargets, classificationHistory),
      ...(classify && { history: saved?.editions.map(classificationHistory) }),
      ...(describeFestival && {
        savedDescriptions: {
          ...(isAssigned(options.input, "event.fields.description") && {
            description: saved?.description ?? null,
          }),
          ...(isAssigned(options.input, "event.fields.shortDescription") && {
            shortDescription: saved?.shortDescription ?? null,
          }),
        },
      }),
      ...(classify && { vocabulary: classificationVocabulary(terms) }),
      corpus: evidencePacket(
        options.corpus,
        describeFestival
          ? [...roleEvidenceTopics.classification, "location"]
          : roleEvidenceTopics.classification,
      ),
    },
    schema: output.extend({
      previousEdition: roleTargets.previousEdition
        ? classificationReplySchema.shape.previousEdition
        : z.null(),
      currentOrNextEdition: roleTargets.currentOrNextEdition
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

import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
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
import { classificationOutputSchema } from "./contracts";
import { classificationInstructions, descriptionInstructions } from "./prompt";

function classificationHistory(edition: SavedEdition) {
  return { ...editionChronology(edition), terms: edition.terms };
}
export function runClassification(options: RoleOptions, targets: Targets) {
  const describeFestival = options.input.scope !== "current";
  const saved = options.context.catalog.find(
    (event) => event.id === (options.input.eventId ?? targets.eventId),
  );
  const output = describeFestival
    ? classificationOutputSchema
    : classificationOutputSchema.omit({
        description: true,
        shortDescription: true,
      });
  return invokeRole({
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
      vocabulary: options.context.terms,
      corpus: evidencePacket(
        options.corpus,
        describeFestival
          ? [...roleEvidenceTopics.classification, "location"]
          : roleEvidenceTopics.classification,
      ),
    },
    schema: output.extend({
      previousEdition: targets.previousEdition
        ? classificationOutputSchema.shape.previousEdition
        : z.null(),
      currentOrNextEdition: targets.currentOrNextEdition
        ? classificationOutputSchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
}

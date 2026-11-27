import { evidencePacket } from "../../evidence/contracts";
import { assignmentPermissions, specialistChecks } from "../assignment";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { z } from "zod";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleRuntimeOptions,
  type SavedEvent,
  type SpecialistContext,
  type TargetContextSelection,
} from "../options";
import { linksOutputSchema } from "./contracts";
import { LINKS_PROMPT_VERSION, linksInstructions } from "./prompt";

type LinksInput = Pick<
  SpecialistContext,
  "corpus" | "savedEditions" | "currentDate" | "groups" | "scope"
> & {
  targets: TargetContextSelection;
  savedEventLinks: SavedEvent["links"] | undefined;
};

export function runLinks(
  options: RoleRuntimeOptions,
  {
    corpus,
    targets,
    groups,
    savedEventLinks,
    savedEditions,
    currentDate,
    scope,
  }: LinksInput,
) {
  const permissions = assignmentPermissions(scope);
  return invokeRole({
    ...roleInvocationOptions(options, "links"),
    role: "links",
    version: LINKS_PROMPT_VERSION,
    instructions: linksInstructions,
    input: {
      assignedChecks: specialistChecks("links", groups),
      targets: targetContext(targets, savedEditions, currentDate, (saved) => ({
        ...editionChronology(saved),
        links: saved.links,
      })),
      permissions,
      savedEventLinks,
      corpus: evidencePacket(corpus, roleEvidenceTopics.links, {
        anchors: true,
      }),
    },
    schema: linksOutputSchema.extend({
      event: permissions.eventFields
        ? linksOutputSchema.shape.event
        : z.strictObject({ socials: z.strictObject({}) }),
      currentOrNextEdition: targets.currentOrNextEdition
        ? linksOutputSchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
}

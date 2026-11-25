import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { z } from "zod";
import { assignedRoleChecks, buildAssignment } from "../assignment";
import type { Targets } from "../general/contracts";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleOptions,
} from "../options";
import { linksOutputSchema } from "./contracts";
import { LINKS_PROMPT_VERSION, linksInstructions } from "./prompt";

export function runLinks(options: RoleOptions, targets: Targets) {
  const { permissions } = buildAssignment(options.input, options.context);
  return invokeRole({
    ...roleInvocationOptions(options, "links"),
    role: "links",
    version: LINKS_PROMPT_VERSION,
    instructions: linksInstructions,
    input: {
      assignedChecks: assignedRoleChecks("links", options.input, targets),
      targets: targetContext(options, targets, (saved) => ({
        ...editionChronology(saved),
        links: saved.links,
      })),
      permissions,
      savedEventLinks: options.context.catalog.find(
        (event) => event.id === (options.input.eventId ?? targets.eventId),
      )?.links,
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.links, {
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

import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import { z } from "zod";
import { assignedRoleChecks, buildAssignment } from "../assignment";
import { isAssigned } from "../../groups";
import { effectiveScope } from "../../scope";
import type { Targets } from "../general/contracts";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleOptions,
} from "../options";
import { linksOutputSchema } from "./contracts";
import { linksInstructions } from "./prompt";

export function runLinks(options: RoleOptions, targets: Targets) {
  const { permissions } = buildAssignment(options.input, options.context);
  const socialSchema = linksOutputSchema.shape.event.shape.socials;
  const socials = socialSchema.pick(
    Object.fromEntries(
      Object.keys(socialSchema.shape)
        .filter((field) =>
          isAssigned(options.input, `event.fields.links.socials.${field}`),
        )
        .map((field) => [field, true]),
    ) as Record<keyof typeof socialSchema.shape, true>,
  );
  const tickets =
    !!targets.currentOrNextEdition &&
    isAssigned(options.input, "currentOrNextEdition.fields.links.tickets");
  const roleTargets = {
    ...targets,
    previousEdition: null,
    currentOrNextEdition: tickets ? targets.currentOrNextEdition : null,
  };
  return invokeRole({
    ...roleInvocationOptions(options, "links"),
    role: "links",
    version: PROMPT_VERSIONS.links,
    instructions: linksInstructions + returnInstructions,
    input: {
      scope: effectiveScope(options.input),
      assignedChecks: assignedRoleChecks("links", options.input, targets),
      targets: targetContext(options, roleTargets, (saved) => ({
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
      event: z.strictObject({
        ...(isAssigned(options.input, "event.fields.links.website") && {
          website: linksOutputSchema.shape.event.shape.website,
        }),
        socials,
      }),
      currentOrNextEdition: tickets
        ? linksOutputSchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
}

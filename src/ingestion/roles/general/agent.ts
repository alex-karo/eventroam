import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import { assignedRoleChecks, buildAssignment } from "../assignment";
import {
  editionChronology,
  roleInvocationOptions,
  type RoleOptions,
} from "../options";
import {
  generalOutputSchema,
  generalFieldsSchema,
  targetSchema,
  type GeneralOutput,
} from "./contracts";
import { z } from "zod";
import { assignedGroups } from "../../groups";
import { requestsSlot } from "../../scope";
import { generalInstructions } from "./prompt";

export function runGeneral(options: RoleOptions) {
  const { identityTask, identityContext, currentDate, permissions, scope } =
    buildAssignment(options.input, options.context);
  const groups = assignedGroups(scope);
  const slotSchema = (slot: "previousEdition" | "currentOrNextEdition") =>
    requestsSlot(options.input, slot)
      ? targetSchema
          .extend({
            fields: generalFieldsSchema.pick(
              Object.fromEntries(
                groups
                  .filter(
                    (group) =>
                      group.owner === "general" && group.target === slot,
                  )
                  .map(({ path }) => [path.split(".fields.")[1], true]),
              ) as Record<keyof typeof generalFieldsSchema.shape, true>,
            ),
          })
          .nullable()
      : z.null();
  const choices = [
    generalOutputSchema.options[1],
    generalOutputSchema.options[2].extend({
      previousEdition: slotSchema("previousEdition"),
      currentOrNextEdition: slotSchema("currentOrNextEdition"),
    }),
  ] as const;
  const schema = (
    options.input.mode === "add"
      ? z.discriminatedUnion("decision", [
          generalOutputSchema.options[0],
          ...choices,
        ])
      : z.discriminatedUnion("decision", choices)
  ) as z.ZodType<GeneralOutput>;
  return invokeRole({
    ...roleInvocationOptions(options, "general"),
    role: "general",
    version: PROMPT_VERSIONS.general,
    instructions: generalInstructions + returnInstructions,
    input: {
      assignment: {
        identityTask,
        identityContext,
        currentDate,
        permissions,
        scope,
      },
      assignedChecks: assignedRoleChecks("general", options.input),
      candidates: options.context.catalog.map((event) => ({
        id: event.id,
        canonicalName: event.canonicalName,
        aliases: event.aliases,
        version: event.version,
        publicationState: event.publicationState,
        links: event.links
          .filter((link) => link.official)
          .map(({ kind, url }) => ({ kind, url })),
        editions: (permissions.previousEdition ||
        permissions.currentOrNextEdition
          ? event.editions
          : []
        ).map((edition) => ({
          ...editionChronology(edition),
          id: edition.id,
          eventId: edition.eventId,
          version: edition.version,
          displayName: edition.displayName,
          dateState: edition.dateState,
          timeZone: edition.timeZone,
          sizeEstimate: edition.sizeEstimate,
          countryCode: edition.countryCode,
          locality: edition.locality,
          venueName: edition.venueName,
          venueAddress: edition.venueAddress,
          publicationState: edition.publicationState,
        })),
      })),
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.general),
    },
    schema,
  });
}

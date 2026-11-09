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
import { generalOutputSchema, refreshGeneralOutputSchema } from "./contracts";
import { generalInstructions } from "./prompt";

export function runGeneral(options: RoleOptions) {
  const { identityTask, identityContext, currentDate, permissions } =
    buildAssignment(options.input, options.context);
  return invokeRole({
    ...roleInvocationOptions(options, "general"),
    role: "general",
    version: PROMPT_VERSIONS.general,
    instructions: generalInstructions + returnInstructions,
    input: {
      assignment: { identityTask, identityContext, currentDate, permissions },
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
        editions: event.editions.map((edition) => ({
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
    schema:
      options.input.mode === "refresh"
        ? refreshGeneralOutputSchema
        : generalOutputSchema,
  });
}

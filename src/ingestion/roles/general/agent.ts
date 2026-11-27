import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { buildAssignment, generalChecks, refreshScope } from "../assignment";
import {
  editionChronology,
  roleInvocationOptions,
  type RoleOptions,
} from "../options";
import { generalOutputSchema } from "./contracts";
import { GENERAL_PROMPT_VERSION, generalInstructions } from "./prompt";

export function runGeneral(options: RoleOptions) {
  const savedEvent = options.context.catalog.at(0);
  const { identityTask, identityContext, currentDate, permissions } =
    buildAssignment(options.input, options.context);
  return invokeRole({
    ...roleInvocationOptions(options, "general"),
    role: "general",
    version: GENERAL_PROMPT_VERSION,
    instructions: generalInstructions,
    input: {
      assignment: { identityTask, identityContext, currentDate, permissions },
      assignedChecks: generalChecks(refreshScope(options.input)),
      savedEvent: savedEvent && {
        id: savedEvent.id,
        canonicalName: savedEvent.canonicalName,
        aliases: savedEvent.aliases,
        version: savedEvent.version,
        publicationState: savedEvent.publicationState,
        links: savedEvent.links
          .filter((link) => link.official)
          .map(({ kind, url }) => ({ kind, url })),
        editions: savedEvent.editions.map((edition) => ({
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
      },
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.general),
    },
    schema: generalOutputSchema,
  });
}

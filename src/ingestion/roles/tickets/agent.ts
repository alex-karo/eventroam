import { evidencePacket } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import { assignedRoleChecks } from "../assignment";
import type { Targets } from "../general/contracts";
import {
  editionChronology,
  roleInvocationOptions,
  targetContext,
  type RoleOptions,
} from "../options";
import { ticketsOutputSchema } from "./contracts";
import { ticketsInstructions } from "./prompt";

export function runTickets(options: RoleOptions, targets: Targets) {
  const selected = targetContext(options, targets).currentOrNextEdition;
  const saved = options.context.catalog
    .find((event) => event.id === (options.input.eventId ?? targets.eventId))
    ?.editions.find((edition) => edition.editionKey === selected?.editionKey);
  return invokeRole({
    ...roleInvocationOptions(options, "tickets"),
    role: "tickets",
    version: PROMPT_VERSIONS.tickets,
    instructions: ticketsInstructions + returnInstructions,
    input: {
      assignedChecks: assignedRoleChecks("tickets", options.input, targets),
      currentDate: options.context.currentDate,
      target: selected
        ? {
            ...selected,
            saved: {
              ...(saved ? editionChronology(saved) : {}),
              priceDetails: saved?.priceDetails.map((offer) =>
                Object.fromEntries(
                  Object.entries(offer).filter(([key]) => key !== "url"),
                ),
              ),
              basePrice: saved
                ? {
                    kind: saved.priceKind,
                    currency: saved.priceCurrency,
                    minMinor: saved.priceMinMinor,
                    maxMinor: saved.priceMaxMinor,
                  }
                : null,
            },
          }
        : null,
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.tickets),
    },
    schema: ticketsOutputSchema,
  });
}

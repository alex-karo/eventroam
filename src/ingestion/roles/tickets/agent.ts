import { evidencePacket } from "../../evidence/contracts";
import { specialistChecks } from "../assignment";
import { roleEvidenceTopics } from "../contracts";
import { invokeRole } from "../invoke";
import { returnInstructions } from "../prompts";
import { PROMPT_VERSIONS } from "../versions";
import type { Targets } from "../general/contracts";
import {
  editionChronology,
  roleInvocationOptions,
  targetEditionContext,
  type RoleRuntimeOptions,
  type SavedEdition,
  type SpecialistContext,
} from "../options";
import { ticketsOutputSchema } from "./contracts";
import { ticketsInstructions } from "./prompt";

type TicketsInput = Pick<
  SpecialistContext,
  "corpus" | "currentDate" | "groups"
> & {
  target: Targets["currentOrNextEdition"];
  saved: SavedEdition | undefined;
};

export function runTickets(
  options: RoleRuntimeOptions,
  { corpus, target, saved, groups, currentDate }: TicketsInput,
) {
  const selected = targetEditionContext(target, saved);
  return invokeRole({
    ...roleInvocationOptions(options, "tickets"),
    role: "tickets",
    version: PROMPT_VERSIONS.tickets,
    instructions: ticketsInstructions + returnInstructions,
    input: {
      assignedChecks: specialistChecks("tickets", groups),
      currentDate,
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
      corpus: evidencePacket(corpus, roleEvidenceTopics.tickets),
    },
    schema: ticketsOutputSchema,
  });
}

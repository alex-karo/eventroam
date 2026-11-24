import type { LinksOutput } from "../../roles/links/contracts";
import type { TicketsOutput } from "../../roles/tickets/contracts";

export function emptyTicketsReply(): TicketsOutput {
  return { currentOrNextEdition: {}, checks: [], unresolved: [] };
}

export function emptyLinksReply(): LinksOutput {
  return {
    event: { socials: {} },
    currentOrNextEdition: {},
    omitted: [],
    checks: [],
    unresolved: [],
  };
}

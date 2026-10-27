import type { MainContext } from "./context";
import { fillConditions } from "./context";
import {
  basePrice,
  classification,
  offerChecks,
  requiredFacts,
  statusFacts,
  termIds,
} from "./checks";
import { evaluate, fact, linkFact } from "./facts";

export function wacken(context: MainContext) {
  const { event, next } = context;
  // tickets.md: overview and the two exact store links printed on the page.
  const urls = [
    "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_ticket_button_20260802",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_pre-sale_20260817",
  ];
  return evaluate({
    // page.md and travel.md: four-day open-air metal festival in Wacken, Germany.
    required: requiredFacts(next, 2027, "2027-07-28", "2027-07-31", "DE"),
    additional: [
      ...statusFacts(next),
      fact("next.locality", next?.locality, ["Wacken"]),
      fact("next.genre", termIds(next, ["genre"]), [
        ["catalog:term:genre:metal"],
      ]),
      fact("next.format", termIds(next, ["format"]), [["validation:openair"]]),
      linkFact("event.website", event?.links, "official_site", [
        "https://www.wacken.com/",
        "https://www.wacken.com/de/",
        "https://www.wacken.com/en/",
      ]),
      linkFact("event.links.youtube", event?.links, "youtube", [
        "https://www.youtube.com/wackentv",
        "https://www.youtube.com/channel/UCvQT6N9nu2BJ-lJuMg1jEZQ",
      ]),
      linkFact("next.tickets", next?.links, "ticketing", urls),
      // tickets.md: unrestricted LOUDER admission, EUR 364 plus mandatory EUR 2 fee.
      basePrice(next, "EUR", 36600),
    ],
    correctness: [
      context.saved,
      classification(next, ["catalog:term:genre:metal", "validation:openair"]),
      // Offers may quote the displayed amount or its total with the stated fee.
      ...offerChecks(next, [
        { urls, amounts: [364, 366, 279, 281, 1399, 1049], currency: "EUR" },
      ]),
    ],
    conditions: [...context.conditions, ...fillConditions(context)],
  });
}

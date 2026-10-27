import type { MainContext } from "./context";
import { fillConditions, savedEditions } from "./context";
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
  // tickets.md: overview and store links, with or without tracking parameters.
  const urls = [
    "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_ticket_button_20260802",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_pre-sale_20260817",
    "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_aftermovie_20260823",
  ];
  return evaluate({
    // page.md and travel.md: four-day metal festival in Wacken, Germany.
    required: requiredFacts(next, 2027, "2027-07-28", "2027-07-31", "DE"),
    additional: [
      ...statusFacts(next),
      fact("next.locality", next?.locality, ["Wacken"]),
      fact("next.genre", termIds(next, ["genre"]), [
        ["catalog:term:genre:metal"],
      ]),
      linkFact("event.website", event?.links, "official_site", [
        "https://www.wacken.com/",
        "https://www.wacken.com/de/",
        "https://www.wacken.com/en/",
      ]),
      linkFact("event.links.youtube", event?.links, "youtube", [
        "https://www.youtube.com/wackentv",
        "https://www.youtube.com/channel/UCvQT6N9nu2BJ-lJuMg1jEZQ",
      ]),
      // ticket-exchange.md: the official resale portal also serves this Edition.
      linkFact("next.tickets", next?.links, "ticketing", [
        ...urls,
        "https://ticketcenter.wacken.com/",
      ]),
      // tickets.md: unrestricted LOUDER admission, EUR 364 plus mandatory EUR 2 fee.
      basePrice(next, "EUR", 36400, 36600),
    ],
    correctness: [
      // Full refresh can add these details to the selected completed Edition.
      savedEditions(context.original, event, {
        displayName: "W:O:A 2026",
        termIds: ["validation:festival", "validation:music"],
        publicationState: "published",
        locality: "Wacken",
        administrativeArea: "Schleswig-Holstein",
        latitude: 54.02078040137254,
        longitude: 9.375972747802734,
        coordinatePrecision: "locality",
      }),
      classification(next, ["catalog:term:genre:metal", "validation:openair"]),
      // Offers may quote the displayed amount or its total with the stated fee.
      ...offerChecks(next, [
        { urls, amounts: [364, 366, 279, 281, 1399, 1049], currency: "EUR" },
      ]),
    ],
    conditions: [...context.conditions, ...fillConditions(context)],
  });
}

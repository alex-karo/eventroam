import type { MainContext } from "./context";
import { fillConditions, savedEditions } from "./context";
import {
  basePrice,
  classification,
  offerChecks,
  requiredFacts,
  statusFacts,
} from "./checks";
import { evaluate, fact, linkFact } from "./facts";

export function sziget(context: MainContext) {
  const { event, next } = context;
  // page.md: standard, age-restricted, and VIP five-day passes with stated fees.
  const offers = [
    {
      urls: ["https://szi.gt/5daypass_2027"],
      amounts: [349, 372],
      currency: "EUR",
    },
    {
      urls: ["https://szi.gt/21andUnderPass_2027"],
      amounts: [279, 297],
      currency: "EUR",
    },
    {
      urls: ["https://szi.gt/VIP_5day_2027"],
      amounts: [569, 606],
      currency: "EUR",
    },
  ];
  return evaluate({
    required: requiredFacts(next, 2027, "2027-08-10", "2027-08-14", "HU"),
    additional: [
      ...statusFacts(next),
      // travel.md: island venue and festival address.
      fact("next.locality", next?.locality, ["Budapest"]),
      fact("next.venue", next?.venueName, [
        "Óbuda Island",
        "Obuda Island",
        "Hajógyári Island",
        "Hajógyári-sziget",
      ]),
      fact("next.address", next?.venueAddress, [
        "Május 9. park",
        "Május 9. park, Budapest, Hungary, 1033",
        "Május 9. park, 1033 Budapest, Hungary",
      ]),
      linkFact("event.website", event?.links, "official_site", [
        "https://szigetfestival.com/en/",
        "https://www.szigetfestival.com/",
        "https://szigetfestival.com/hu/",
      ]),
      linkFact("next.tickets", next?.links, "ticketing", [
        "https://szigetfestival.com/en/tickets",
        ...offers.flatMap((offer) => offer.urls),
      ]),
      // Unrestricted pass: EUR 349 plus mandatory EUR 23 handling fee.
      basePrice(next, "EUR", 34900, 37200),
    ],
    correctness: [
      // Recap and shared travel page also describe the selected 2026 Edition.
      savedEditions(context.original, event, {
        displayName: "Sziget Festival 2026",
        // The recap confirms the past music festival; saved dates and country satisfy the other publication gates.
        termIds: ["validation:festival", "validation:music"],
        publicationState: "published",
        venueName: "Óbuda Island",
        venueAddress: "Május 9. park, Budapest, Hungary, 1033",
        locality: "Budapest",
        // The declared geocoding response is a city point, not a venue point.
        latitude: 47.49835,
        longitude: 19.04045,
        coordinatePrecision: "locality",
      }),
      // experience.md lists house, techno, and trance.
      classification(next, [
        "validation:openair",
        "catalog:term:genre:electronic",
      ]),
      ...offerChecks(next, offers),
    ],
    conditions: [...context.conditions, ...fillConditions(context)],
  });
}

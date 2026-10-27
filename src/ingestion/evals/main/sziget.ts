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
      fact("next.format", termIds(next, ["format"]), [["validation:openair"]]),
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
      basePrice(next, "EUR", 37200),
    ],
    correctness: [
      context.saved,
      classification(next, ["validation:openair"]),
      ...offerChecks(next, offers),
    ],
    conditions: [...context.conditions, ...fillConditions(context)],
  });
}

import { researchDidNotFail } from "../research";
import type { MainContext } from "./context";
import { savedEditions } from "./context";
import { fillConditions } from "./context";
import {
  basePrice,
  classification,
  offerChecks,
  requiredFacts,
  statusFacts,
} from "./checks";
import { evaluate, fact, linkFact } from "./facts";

export function roskilde(context: MainContext) {
  const { event, next } = context;
  // tickets.md: admission products. Gift cards and the Pumpehuset event are excluded.
  const offers = [
    ["fz3fh09", 2650],
    ["7g0tvpp", 2230],
    ["2rrklcf", 1530],
    ["pjkf5p5", 1530],
    ["n9tcbkm", 1530],
    ["9rdr0dv", 1530],
  ] as const;
  return evaluate({
    // page.md and purpose.md: 2027 music festival in Denmark.
    required: requiredFacts(next, 2027, "2027-06-26", "2027-07-03", "DK"),
    additional: [
      ...statusFacts(next),
      // contact.md: festival site, separate from the office address.
      fact("next.locality", next?.locality, ["Roskilde"]),
      fact("next.venue", next?.venueName, [
        "Festivalpladsen",
        "Roskilde Festival",
        "Roskilde Festivalplads",
      ]),
      fact("next.address", next?.venueAddress, [
        "Darupvej 19",
        "Darupvej 19, 4000 Roskilde",
        "Festivalpladsen, Darupvej 19, 4000 Roskilde, Denmark",
      ]),
      linkFact("event.website", event?.links, "official_site", [
        "https://www.roskilde-festival.dk/",
      ]),
      linkFact("event.links.instagram", event?.links, "instagram", [
        "https://instagram.com/roskildefestival",
        "https://www.instagram.com/roskildefestival/",
      ]),
      linkFact("event.links.facebook", event?.links, "facebook", [
        "https://www.facebook.com/orangefeeling/",
        "https://www.facebook.com/orangefeeling",
      ]),
      // purpose.md: participants, volunteers, artists, and staff.
      fact("next.sizeEstimate", next?.sizeEstimate, [130000]),
      linkFact("next.tickets", next?.links, "ticketing", [
        "https://www.roskilde-festival.dk/billetter",
        // tickets.md: direct admission for all eight festival days.
        "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09",
      ]),
      basePrice(next, "DKK", 265000),
    ],
    // Neither pages nor fixed geocoding responses state a region.
    correctness: [
      // news.md confirms the completed 2026 music festival.
      savedEditions(context.original, event, {
        termIds: ["validation:festival", "validation:music"],
        publicationState: "published",
        locality: "Roskilde",
        latitude: 55.64152,
        longitude: 12.08035,
        coordinatePrecision: "locality",
      }),
      // first-artists.md describes electronic music and death-doom acts.
      classification(next, [
        "catalog:term:genre:electronic",
        "catalog:term:genre:metal",
      ]),
      ...offerChecks(next, [
        ...offers.map(([code, amount]) => ({
          urls: [
            `https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=${code}`,
          ],
          amounts: [amount],
          currency: "DKK",
        })),
        {
          urls: [
            "https://ticket.roskilde-festival.dk/da/3e9u8rgkhdlw9dg/products",
          ],
          // Accept the displayed monthly amount or the full cost with the fee.
          amounts: [524, 2720],
          currency: "DKK",
        },
      ]),
    ],
    conditions: [
      ...context.conditions,
      ...researchDidNotFail(context.report),
      ...fillConditions(context),
    ],
  });
}

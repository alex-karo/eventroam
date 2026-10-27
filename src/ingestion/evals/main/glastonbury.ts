import { researchDidNotFail } from "../research";
import { check } from "../checks";
import type { MainContext } from "./context";
import { evaluate, fact, linkFact } from "./facts";

export function glastonbury(context: MainContext) {
  const history = context.created.find(
    (edition) => edition.editionYear === 2025,
  );
  // page.md confirms these links, but does not confirm the saved 2027 programme.
  return evaluate({
    required: [],
    additional: [
      linkFact("event.website", context.event?.links, "official_site", [
        "https://www.glastonburyfestivals.co.uk/",
      ]),
      linkFact("event.links.instagram", context.event?.links, "instagram", [
        "https://instagram.com/glastofest",
      ]),
      linkFact("event.links.tiktok", context.event?.links, "tiktok", [
        "https://tiktok.com/@glastonbury",
      ]),
      linkFact("event.links.facebook", context.event?.links, "facebook", [
        "https://www.facebook.com/glastonburyofficial",
      ]),
      // history-2025.md confirms the year and GBP 378.50 admission price.
      fact("history.year", history?.editionYear, [2025]),
      fact("history.country", history?.countryCode, ["GB"]),
      fact(
        "history.basePrice",
        history?.priceKind
          ? {
              kind: history.priceKind,
              currency: history.priceCurrency,
              minMinor: history.priceMinMinor,
              maxMinor: history.priceMaxMinor,
              coverage: history.priceCoverage,
            }
          : null,
        [
          {
            kind: "exact",
            currency: "GBP",
            minMinor: 37850,
            maxMinor: 37850,
            coverage: "full_programme",
          },
        ],
      ),
    ],
    correctness: [
      context.saved,
      // Capacity is not participant attendance.
      fact("history.sizeEstimate", history?.sizeEstimate ?? null, [null]),
      ...(history?.priceDetails ?? []).map((offer, index) =>
        fact(
          `history.offers.${index}`,
          { amount: offer.amount, currency: offer.currency },
          [{ amount: 378.5, currency: "GBP" }],
        ),
      ),
    ],
    conditions: [
      ...context.conditions,
      ...researchDidNotFail(context.report),
      // Neither history page provides programme dates.
      check(
        "editions.identity",
        context.created.length <= 1 &&
          context.created.every(
            (edition) =>
              edition.editionYear === 2025 && edition.countryCode === "GB",
          ),
      ),
      check(
        "history.dates",
        context.created.every(
          (edition) =>
            edition.startsOn === null &&
            edition.endsOn === null &&
            edition.dateState === "unknown",
        ),
      ),
      check(
        "publication",
        context.event?.publicationState === "draft" &&
          context.created.every(
            (edition) => edition.publicationState === "draft",
          ),
      ),
    ],
  });
}

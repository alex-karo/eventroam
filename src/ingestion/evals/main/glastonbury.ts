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
      // The archive confirms the year. Historical tickets are outside ingestion.
      fact("history.year", history?.editionYear, [2025]),
      fact("history.country", history?.countryCode, ["GB"]),
    ],
    correctness: [
      context.saved,
      // Capacity is not participant attendance.
      fact("history.sizeEstimate", history?.sizeEstimate ?? null, [null]),
      fact(
        "history.ticketsPreserved",
        history
          ? history.priceDetails.length === 0 && history.priceKind === null
          : true,
        [true],
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

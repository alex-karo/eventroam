import { mainScheduleStatuses, type Edition } from "./context";
import { fact } from "./facts";

export function termIds(edition: Edition | undefined, facets: string[]) {
  return (
    edition?.terms
      .filter((term) => facets.includes(term.facet))
      .map((term) => term.id)
      .sort() ?? []
  );
}

export function requiredFacts(
  edition: Edition | undefined,
  year: number,
  startsOn: string,
  endsOn: string,
  country: string,
) {
  return [
    fact("next.year", edition?.editionYear, [year]),
    fact(
      "next.dates",
      { startsOn: edition?.startsOn, endsOn: edition?.endsOn },
      [{ startsOn, endsOn }],
    ),
    fact("next.country", edition?.countryCode, [country]),
    fact("next.eventType", termIds(edition, ["event_type"]), [
      ["validation:festival"],
    ]),
    fact("next.topic", termIds(edition, ["topic", "culture"]), [
      ["validation:music"],
    ]),
  ];
}

export function statusFacts(edition: Edition | undefined) {
  return [
    fact("next.dateState", edition?.dateState, ["confirmed"]),
    fact("next.scheduleStatus", edition?.scheduleStatus, mainScheduleStatuses),
  ];
}

export function classification(
  edition: Edition | undefined,
  extra: string[] = [],
) {
  const allowed = ["validation:festival", "validation:music", ...extra];
  return fact(
    "next.classification",
    edition?.terms.every((term) => allowed.includes(term.id)),
    [true],
  );
}

export function basePrice(
  edition: Edition | undefined,
  currency: string,
  ...amountsMinor: number[]
) {
  return fact(
    "next.basePrice",
    edition?.priceKind
      ? {
          kind: edition.priceKind,
          currency: edition.priceCurrency,
          minMinor: edition.priceMinMinor,
          maxMinor: edition.priceMaxMinor,
          coverage: edition.priceCoverage,
        }
      : null,
    amountsMinor.map((amountMinor) => ({
      kind: "exact",
      currency,
      minMinor: amountMinor,
      maxMinor: amountMinor,
      coverage: "full_programme",
    })),
  );
}

export type Offer = { urls: string[]; amounts: number[]; currency: string };
/** Check returned offers only. Labels, terms, availability, and duplicates are outside this boundary. */
export function offerChecks(
  edition: Pick<Edition, "priceDetails"> | undefined,
  allowed: Offer[],
) {
  return (edition?.priceDetails ?? []).map((offer, index) =>
    fact(
      `next.offers.${index}`,
      allowed.some(
        (expected) =>
          expected.amounts.includes(offer.amount!) &&
          offer.currency === expected.currency,
      ),
      [true],
    ),
  );
}

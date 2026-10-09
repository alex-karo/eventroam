import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import { minorToMajor } from "./money";
import type { ResearchCatalog } from "./prepare";
export function savedTickets(
  edition: ResearchCatalog[number]["editions"][number],
) {
  const {
    priceKind,
    priceCurrency,
    priceMinMinor,
    priceMaxMinor,
    priceCoverage,
    priceQualification,
    priceDetails,
  } = edition;
  const qualification = priceQualification
    ? { qualification: priceQualification }
    : {};
  let basePrice = null;
  if (priceKind === "free") {
    basePrice = {
      kind: "free",
      coverage: priceCoverage,
      ...qualification,
    };
  } else if (
    priceKind &&
    priceCurrency &&
    priceMinMinor !== null &&
    priceMaxMinor !== null
  ) {
    basePrice = {
      kind: priceKind,
      currency: priceCurrency,
      minAmount: minorToMajor(priceMinMinor, priceCurrency),
      maxAmount: minorToMajor(priceMaxMinor, priceCurrency),
      coverage: priceCoverage,
      ...qualification,
    };
  }
  return structuredClone({ variants: priceDetails, basePrice });
}

export function modelContext(target: ResearchCatalog[number]) {
  return {
    ...target,
    editions: target.editions.map((edition) => ({
      ...Object.fromEntries(
        Object.entries(edition).filter(([key]) => !key.startsWith("price")),
      ),
      ticketSourceUrls: [
        ...new Set(
          edition.priceDetails.flatMap((variant) =>
            variant.url &&
            /^https?:\/\//.test(variant.url) &&
            URL.canParse(variant.url)
              ? [normalizeCatalogUrl(variant.url)]
              : [],
          ),
        ),
      ],
    })),
  };
}

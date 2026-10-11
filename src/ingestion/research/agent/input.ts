import type { CatalogResearchInput } from "../../contracts";
import type { ResearchBudget } from "../../runtime/budget";
import type { KnownSourceLink } from "../../tools/contracts";
import type { ReadSourceResult } from "../../tools/read-source/contracts";
import type { ResearchCatalog } from "../context";
import { minorToMajor } from "../money";
import { researchInstructions } from "./prompt";
import { boundedToolSource } from "../../tools/read-source/response";

export function promptFor(
  input: CatalogResearchInput,
  catalog: ResearchCatalog,
  knownLinks: KnownSourceLink[],
  terms: { id: string; facet: string; slug: string }[],
  remaining: ReturnType<ResearchBudget["remaining"]>,
  reads: ReadSourceResult[],
  todayUtc = new Date().toISOString().slice(0, 10),
) {
  const target = catalog.find((event) => event.id === input.eventId);
  return JSON.stringify({
    task: researchInstructions,
    todayUtc,
    mode: input.mode,
    eventId: input.eventId,
    remaining,
    name: input.name,
    knownLinks,
    catalog: catalog.map((event) => ({
      id: event.id,
      name: event.canonicalName,
      aliases: event.aliases,
      links: event.links.map(({ kind, url }) => ({ kind, url })),
      editions: event.editions.map((edition) => ({
        key: edition.editionKey,
        year: edition.editionYear,
        countryCode: edition.countryCode,
      })),
    })),
    compact: target ? modelContext(target) : null,
    terms,
    inspectedSources: reads.map((read) =>
      boundedToolSource(read, Math.floor(80_000 / Math.max(1, reads.length))),
    ),
  });
}

export function modelContext(target: ResearchCatalog[number]) {
  return {
    ...target,
    editions: target.editions.map((edition) => {
      const {
        priceKind,
        priceCurrency,
        priceMinMinor,
        priceMaxMinor,
        priceCoverage,
        priceQualification,
        priceDetails,
      } = edition;
      const rest = Object.fromEntries(
        Object.entries(edition).filter(
          ([key]) => key !== "priceDetails" && !key.startsWith("price"),
        ),
      );
      const qualification = priceQualification
        ? { qualification: priceQualification }
        : {};
      let basePrice = null;
      if (priceKind === "free") {
        basePrice = {
          kind: "free",
          coverage: "full_programme",
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
      return { ...rest, tickets: { variants: priceDetails, basePrice } };
    }),
  };
}

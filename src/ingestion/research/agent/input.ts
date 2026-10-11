import type { CatalogResearchInput } from "../../contracts";
import type { ResearchBudget } from "../../runtime/budget";
import type {
  KnownSourceLink,
  ReadSourceResult,
} from "../../sources/contracts";
import type { ResearchCatalog } from "../context";
import { minorToMajor } from "../money";
import { researchInstructions } from "./prompt";

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
        key: edition.occurrenceKey,
        year: edition.occurrenceYear,
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

function safeSource(read: ReadSourceResult) {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    outcome: read.outcome,
    ...(read.reason ? { reason: read.reason } : {}),
  };
}

export function boundedToolSource(read: ReadSourceResult, maxChars = 80_000) {
  const markdownBudget = Math.max(1_000, maxChars - 300);
  let markdown = read.markdown;
  if (markdown.length > markdownBudget) {
    const boundary = markdown.lastIndexOf("\n\n", markdownBudget);
    markdown = markdown.slice(0, boundary > 0 ? boundary : markdownBudget);
  }
  return {
    ...safeSource(read),
    markdown,
    truncated: markdown.length < read.markdown.length,
    completeness:
      markdown.length < read.markdown.length ? "partial" : read.completeness,
  };
}

import type { CatalogResearchInput } from "@/ingestion/contracts";
import type { ResearchBudget } from "@/ingestion/runtime/budget";
import type { KnownSourceLink } from "@/ingestion/tools/contracts";
import type { ReadPageResult } from "@/ingestion/tools/read-page/contracts";
import type { ResearchCatalog } from "@/ingestion/research/context";
import { minorToMajor } from "@/ingestion/research/money";
import { researchInstructionsFor } from "@/test/ingestion-fixtures/research-prompt";
import { boundedToolSource } from "@/ingestion/tools/read-page/response";

export function promptFor(
  input: CatalogResearchInput,
  catalog: ResearchCatalog,
  knownLinks: KnownSourceLink[],
  terms: { id: string; facet: string; slug: string }[],
  remaining: ReturnType<ResearchBudget["remaining"]>,
  reads: ReadPageResult[],
  currentDate = new Date().toISOString(),
  onInspectedSources?: (
    sources: ReturnType<typeof boundedToolSource>[],
  ) => void,
) {
  const target = catalog.find((event) => event.id === input.eventId);
  const project =
    input.mode === "refresh" && input.scope === "current"
      ? currentModelContext
      : modelContext;
  const inspectedSources = reads.map((read) =>
    boundedToolSource(read, Math.floor(80_000 / Math.max(1, reads.length))),
  );
  const prompt = JSON.stringify({
    task: researchInstructionsFor(input),
    currentDate,
    mode: input.mode,
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    eventId: input.eventId,
    remaining,
    name: input.name,
    knownLinks,
    catalog:
      input.mode === "add"
        ? catalog.map((event) => ({
            id: event.id,
            name: event.canonicalName,
            aliases: event.aliases,
            links: event.links.map(({ kind, url }) => ({ kind, url })),
            editions: event.editions.map((edition) => ({
              key: edition.editionKey,
              year: edition.editionYear,
              countryCode: edition.countryCode,
            })),
          }))
        : undefined,
    compact: target ? project(target) : null,
    terms,
    inspectedSources,
  });
  onInspectedSources?.(inspectedSources);
  return prompt;
}

export function modelContext(target: ResearchCatalog[number]) {
  return {
    id: target.id,
    canonicalName: target.canonicalName,
    aliases: target.aliases,
    summary: target.summary,
    homeScope: target.homeScope,
    publicationState: target.publicationState,
    links: modelLinks(target.links),
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
      return {
        editionKey: edition.editionKey,
        editionYear: edition.editionYear,
        displayName: edition.displayName,
        startsOn: edition.startsOn,
        endsOn: edition.endsOn,
        dateState: edition.dateState,
        scheduleStatus: edition.scheduleStatus,
        publicationState: edition.publicationState,
        venueName: edition.venueName,
        venueAddress: edition.venueAddress,
        locality: edition.locality,
        administrativeArea: edition.administrativeArea,
        countryCode: edition.countryCode,
        latitude: edition.latitude,
        longitude: edition.longitude,
        coordinatePrecision: edition.coordinatePrecision,
        timeZone: edition.timeZone,
        sizeEstimate: edition.sizeEstimate,
        links: modelLinks(edition.links),
        terms: edition.terms.map(({ id, facet, slug, name }) => ({
          id,
          facet,
          slug,
          name,
        })),
        tickets: { variants: priceDetails, basePrice },
      };
    }),
  };
}

function modelLinks(links: ResearchCatalog[number]["links"]) {
  return links.map(({ kind, url, label, official }) => ({
    kind,
    url,
    label,
    official,
  }));
}

/** Current research keeps every matching key; only the editor sees omitted facts. */
function currentModelContext(target: ResearchCatalog[number]) {
  const saved = modelContext(target);
  return {
    id: saved.id,
    canonicalName: saved.canonicalName,
    aliases: saved.aliases,
    links: saved.links,
    editions: saved.editions.map((edition) => ({
      editionKey: edition.editionKey,
      editionYear: edition.editionYear,
      displayName: edition.displayName,
      startsOn: edition.startsOn,
      endsOn: edition.endsOn,
      dateState: edition.dateState,
      scheduleStatus: edition.scheduleStatus,
      timeZone: edition.timeZone,
      venueName: edition.venueName,
      locality: edition.locality,
      administrativeArea: edition.administrativeArea,
      countryCode: edition.countryCode,
      latitude: edition.latitude,
      longitude: edition.longitude,
      coordinatePrecision: edition.coordinatePrecision,
      links: edition.links,
      terms: edition.terms,
      tickets: edition.tickets,
    })),
  };
}

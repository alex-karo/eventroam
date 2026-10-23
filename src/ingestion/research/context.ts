import type Database from "better-sqlite3";
import {
  readResearchCatalog,
  readResearchEvent,
  readResearchTerms,
} from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import type { KnownSourceLink } from "../tools/contracts";

export function loadResearchContext(
  client: Database.Database,
  input: CatalogResearchInput,
  currentDate = new Date().toISOString(),
) {
  const target = input.eventId
    ? readResearchEvent(client, input.eventId)
    : null;
  if (input.eventId && !target) {
    throw new Error("Event not found");
  }
  const catalog = target ? [target] : readResearchCatalog(client);
  const terms = readResearchTerms(client);
  const knownLinks: KnownSourceLink[] = [
    ...(target?.links.map(({ url, kind, official }) => ({
      url,
      owner: "event" as const,
      kind,
      official,
    })) ?? []),
    ...(target?.editions.flatMap((edition) =>
      edition.links.map(({ url, kind, official }) => ({
        url,
        owner: "edition" as const,
        kind,
        official,
        editionKey: edition.editionKey,
      })),
    ) ?? []),
  ];
  return {
    catalog,
    terms,
    knownLinks,
    currentDate,
  };
}

export type ResearchCatalog = ReturnType<typeof readResearchCatalog>;

export type ResearchContext = ReturnType<typeof loadResearchContext>;

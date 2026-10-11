import { createRefreshContext } from "./scope";
import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { taxonomyTerms } from "@/db/schema";
import {
  readResearchCatalog,
  readResearchEvent,
} from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import type { KnownSourceLink } from "../tools/contracts";

export function loadResearchContext(
  client: Database.Database,
  input: CatalogResearchInput,
  referenceInstant = new Date().toISOString(),
) {
  const target = input.eventId
    ? readResearchEvent(client, input.eventId)
    : null;
  if (input.eventId && !target) {
    throw new Error("Event not found");
  }
  const catalog = target ? [target] : readResearchCatalog(client);
  const terms = drizzle(client)
    .select({
      id: taxonomyTerms.id,
      facet: taxonomyTerms.facet,
      slug: taxonomyTerms.slug,
    })
    .from(taxonomyTerms)
    .all();
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
    refresh:
      input.mode === "refresh"
        ? createRefreshContext(
            input.scope ?? "full",
            target!.editions,
            referenceInstant,
          )
        : null,
  };
}

export type ResearchCatalog = ReturnType<typeof readResearchCatalog>;

export type ResearchContext = ReturnType<typeof loadResearchContext>;

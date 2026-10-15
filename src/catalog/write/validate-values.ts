import type Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { editionTerms, editions, taxonomyTerms } from "@/db/schema";
import {
  validateEventRecord,
  validateEditionRecord,
  validateLinkRecord,
  validateAliasRecord,
  validateTaxonomyTerm,
  validateTermAssignments,
} from "@/catalog/domain/validation";

const termSchema = z.object({
  id: z.string(),
  facet: z.string(),
  parentId: z.string().nullish(),
});
type ValidatedTable =
  | "events"
  | "editions"
  | "external_links"
  | "url_aliases"
  | "taxonomy_terms"
  | "edition_terms";

function validateAncestry(
  client: Database.Database,
  term: z.infer<typeof termSchema>,
) {
  const db = drizzle(client);
  const seen = new Set([term.id]);
  let ancestor = term.parentId;
  while (ancestor != null) {
    if (seen.has(ancestor)) {
      throw new Error("Taxonomy parent cycle");
    }
    seen.add(ancestor);
    const row = db
      .select()
      .from(taxonomyTerms)
      .where(eq(taxonomyTerms.id, ancestor))
      .get();
    if (!row) {
      throw new Error("Unknown taxonomy parent");
    }
    ancestor = row.parentId;
  }
}

/** Validate seed values without changing defaults or nulls. Call inside the write transaction. */
export function validateCatalogValues<T extends Record<string, unknown>>(
  client: Database.Database,
  table: ValidatedTable,
  values: T,
): T {
  if (!client.inTransaction) {
    throw new Error("Catalog value validation needs a write transaction");
  }
  if (table === "events" || table === "editions") {
    z.number().int().positive().default(1).parse(values.version);
  }
  switch (table) {
    case "events":
      validateEventRecord(values);
      break;
    case "editions":
      validateEditionRecord(values);
      break;
    case "external_links":
      validateLinkRecord(values);
      if ((values.eventId != null) === (values.editionId != null)) {
        throw new Error("Link must have exactly one owner");
      }
      break;
    case "url_aliases": {
      validateAliasRecord(values);
      if (values.editionId != null) {
        const edition = drizzle(client)
          .select()
          .from(editions)
          .where(eq(editions.id, z.string().parse(values.editionId)))
          .get();
        if (!edition || edition.eventId !== values.eventId) {
          throw new Error("Alias edition must belong to event");
        }
      }
      break;
    }
    case "taxonomy_terms": {
      const term = termSchema.parse(values);
      const db = drizzle(client);
      const parent =
        term.parentId == null
          ? undefined
          : db
              .select()
              .from(taxonomyTerms)
              .where(eq(taxonomyTerms.id, term.parentId))
              .get();
      const children = db
        .select()
        .from(taxonomyTerms)
        .where(eq(taxonomyTerms.parentId, term.id))
        .all();
      validateTaxonomyTerm(term, parent, children);
      validateAncestry(client, term);
      break;
    }
    case "edition_terms": {
      const { editionId, termId } = z
        .object({ editionId: z.string(), termId: z.string() })
        .parse(values);
      const db = drizzle(client);
      const term = db
        .select()
        .from(taxonomyTerms)
        .where(eq(taxonomyTerms.id, termId))
        .get();
      if (!term) {
        throw new Error("Unknown taxonomy term");
      }
      const assigned = db
        .select({ id: taxonomyTerms.id, facet: taxonomyTerms.facet })
        .from(editionTerms)
        .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, editionTerms.termId))
        .where(eq(editionTerms.editionId, editionId))
        .all();
      validateTermAssignments([...assigned, term]);
      break;
    }
  }
  return values;
}

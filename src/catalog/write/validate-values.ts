import type Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { occurrenceTerms, taxonomyTerms } from "@/db/schema";
import {
  validateEventRecord,
  validateOccurrenceRecord,
  validateSourceRecord,
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
  | "occurrences"
  | "sources"
  | "external_links"
  | "url_aliases"
  | "taxonomy_terms"
  | "occurrence_terms";

/** Validate seed values without changing defaults or nulls. Call inside the write transaction. */
export function validateCatalogValues<T extends Record<string, unknown>>(
  client: Database.Database,
  table: ValidatedTable,
  values: T,
): T {
  switch (table) {
    case "events":
      validateEventRecord(values);
      break;
    case "occurrences":
      validateOccurrenceRecord(values);
      break;
    case "sources":
      validateSourceRecord(values);
      break;
    case "external_links":
      validateLinkRecord(values);
      break;
    case "url_aliases":
      validateAliasRecord(values);
      break;
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
      break;
    }
    case "occurrence_terms": {
      const { occurrenceId, termId } = z
        .object({ occurrenceId: z.string(), termId: z.string() })
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
        .from(occurrenceTerms)
        .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, occurrenceTerms.termId))
        .where(eq(occurrenceTerms.occurrenceId, occurrenceId))
        .all();
      validateTermAssignments([...assigned, term]);
      break;
    }
  }
  return values;
}

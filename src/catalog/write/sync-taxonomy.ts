import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  validateTaxonomyTerm,
  validateTermAssignmentAncestry,
} from "@/catalog/domain/classification";
import { facets } from "@/catalog/domain/vocabulary";
import type { openDatabase } from "@/db/connection";
import { taxonomyTerms } from "@/db/schema";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const entrySchema = z.strictObject({
  facet: z.enum(facets),
  slug,
  name: z.string().trim().min(1),
  parentSlug: slug.optional(),
  description: z.string().trim().min(1).optional(),
});

type Entry = z.infer<typeof entrySchema>;
type Term = typeof taxonomyTerms.$inferSelect;

function termKey(term: Pick<Term, "facet" | "slug">) {
  return `${term.facet}/${term.slug}`;
}

function planSync(terms: Term[], entries: Entry[]) {
  const pending = new Map<string, Entry>();
  for (const entry of entries) {
    const key = termKey(entry);
    if (pending.has(key)) {
      throw new Error(`Duplicate taxonomy term: ${key}`);
    }
    pending.set(key, entry);
  }

  const rows = new Map(terms.map((term) => [term.id, term]));
  const existing = new Map(terms.map((term) => [termKey(term), term]));
  const resolved = new Map<string, Term>();
  const visiting = new Set<string>();
  const additions: Term[] = [];
  const updates: {
    id: string;
    term: string;
    before: Pick<Term, "name" | "description">;
    after: Pick<Term, "name" | "description">;
  }[] = [];
  const parentDifferences: {
    term: string;
    storedParent: string | null;
    declaredParent: string | null;
  }[] = [];

  function planUpdate(
    stored: Term,
    values: Pick<Term, "name" | "description">,
    declaredParentId: string | null,
    parentKey: string | null,
  ) {
    const key = termKey(stored);
    const { id, name, description, parentId } = stored;
    if (name !== values.name || description !== values.description) {
      updates.push({
        id,
        term: key,
        before: { name, description },
        after: values,
      });
    }
    if (parentId !== declaredParentId) {
      const storedParent = parentId ? rows.get(parentId) : undefined;
      parentDifferences.push({
        term: key,
        storedParent: storedParent ? termKey(storedParent) : parentId,
        declaredParent: parentKey,
      });
    }
  }

  function planAddition(row: Term, parent: Term | undefined, key: string) {
    if (rows.has(row.id)) {
      throw new Error(`Taxonomy ID already in use for ${key}: ${row.id}`);
    }
    try {
      validateTaxonomyTerm(row, parent);
      validateTermAssignmentAncestry([row], rows);
    } catch (error) {
      throw new Error(`Invalid taxonomy parent for ${key}: ${String(error)}`, {
        cause: error,
      });
    }
    rows.set(row.id, row);
    additions.push(row);
  }

  function resolve(key: string): Term {
    const known = resolved.get(key);
    if (known) {
      return known;
    }
    if (visiting.has(key)) {
      throw new Error(`Taxonomy parent cycle at ${key}`);
    }
    const entry = pending.get(key)!;
    visiting.add(key);
    const parentKey = entry.parentSlug
      ? termKey({ facet: entry.facet, slug: entry.parentSlug })
      : null;
    if (parentKey && !pending.has(parentKey)) {
      throw new Error(`Unknown taxonomy parent ${parentKey} for ${key}`);
    }
    const parent = parentKey ? resolve(parentKey) : undefined;
    const stored = existing.get(key);
    const values = { name: entry.name, description: entry.description ?? null };
    const row = stored ?? {
      id: `catalog:term:${entry.facet}:${entry.slug}`,
      facet: entry.facet,
      slug: entry.slug,
      parentId: parent?.id ?? null,
      ...values,
    };

    if (stored) {
      planUpdate(stored, values, parent?.id ?? null, parentKey);
    } else {
      planAddition(row, parent, key);
    }
    visiting.delete(key);
    resolved.set(key, row);
    return row;
  }

  for (const key of pending.keys()) {
    resolve(key);
  }
  return { additions, updates, parentDifferences };
}

export function syncTaxonomy(
  { client, db }: ReturnType<typeof openDatabase>,
  vocabulary: unknown,
  apply: boolean,
) {
  const entries = z.array(entrySchema).parse(vocabulary);
  const run = client.transaction(() => {
    const plan = planSync(db.select().from(taxonomyTerms).all(), entries);
    if (apply) {
      for (const term of plan.additions) {
        db.insert(taxonomyTerms).values(term).run();
      }
      for (const { id, after } of plan.updates) {
        db.update(taxonomyTerms)
          .set(after)
          .where(eq(taxonomyTerms.id, id))
          .run();
      }
    }
    return plan;
  });
  return apply ? run.immediate() : run.deferred();
}

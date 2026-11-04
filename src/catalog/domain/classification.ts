import { z } from "zod";
import { facets } from "./vocabulary";

const facetSchema = z.enum(facets);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
export type TaxonomyTerm = {
  id: string;
  facet: string;
  parentId?: string | null;
};
/** Relations are supplied from the same transaction as the proposed write. */
export function validateTaxonomyTerm(
  term: TaxonomyTerm,
  parent?: TaxonomyTerm,
  children: readonly TaxonomyTerm[] = [],
) {
  facetSchema.parse(term.facet);
  if (term.parentId != null) {
    assert(parent?.id === term.parentId, "Unknown taxonomy parent");
    assert(
      parent.facet === term.facet,
      "Taxonomy parent must be in same facet",
    );
  }
  assert(
    children.every((child) => child.facet === term.facet),
    "Taxonomy children must be in same facet",
  );
}

const singleAssignmentFacets = [
  "event_type",
  "format",
] as const satisfies readonly (typeof facets)[number][];

export function validateTermAssignments(terms: readonly TaxonomyTerm[]) {
  for (const term of terms) {
    facetSchema.parse(term.facet);
  }
  for (const facet of singleAssignmentFacets) {
    const assigned = terms.filter((term) => term.facet === facet);
    if (assigned.length > 1) {
      throw new Error(
        `Only one ${facet} term allowed (limit: 1); received: ${assigned.map((term) => term.id).join(", ")}`,
      );
    }
  }
}

/** Supply the full taxonomy so that unassigned parents remain in the chain. */
export function validateTermAssignmentAncestry(
  terms: readonly TaxonomyTerm[],
  taxonomy: ReadonlyMap<string, TaxonomyTerm>,
) {
  const ids = new Set(terms.map((term) => term.id));
  for (const term of terms) {
    const seen = new Set([term.id]);
    let parentId = term.parentId;
    while (parentId != null) {
      assert(!seen.has(parentId), "Taxonomy parent cycle");
      seen.add(parentId);
      assert(!ids.has(parentId), "Do not assign redundant ancestor term");
      const parent = taxonomy.get(parentId);
      assert(parent, "Unknown taxonomy parent");
      parentId = parent.parentId;
    }
  }
}

export function normalizeProposedAssignments(
  ids: readonly string[],
  vocabulary: readonly TaxonomyTerm[],
) {
  const taxonomy = new Map(vocabulary.map((term) => [term.id, term]));
  const terms = ids.map((id) => {
    const term = taxonomy.get(id);
    assert(term, "Unknown classification term");
    return term;
  });
  const selected = new Set(ids);
  assert(selected.size === ids.length, "Duplicate classification term");
  validateTermAssignments(terms);

  const removed = new Set<string>();
  for (const term of terms) {
    const seen = new Set<string>();
    let parent = term.parentId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      if (selected.has(parent)) {
        removed.add(parent);
      }
      parent = taxonomy.get(parent)?.parentId;
    }
  }
  return {
    retained: ids.filter((id) => !removed.has(id)),
    removed: [...removed],
  };
}

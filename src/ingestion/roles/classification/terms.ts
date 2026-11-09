import type { ResearchContext } from "../../research/context";
import { editionSlotNames } from "../../research/contracts";
import type { Targets } from "../general/contracts";
import {
  classificationFacets,
  maxClassificationTerms,
  type ClassificationOutput,
  type ClassificationReply,
  type ClassificationReplyChange,
} from "./contracts";

type SavedEvent = ResearchContext["catalog"][number];
type Terms = ResearchContext["terms"];

export function classificationVocabulary(terms: Terms) {
  const slugsById = new Map(terms.map(({ id, slug }) => [id, slug]));
  return Object.fromEntries(
    classificationFacets.map(([field, facet]) => [
      field,
      terms
        .filter((term) => term.facet === facet)
        .map(({ slug, parentId }) => ({
          slug,
          parentSlug: parentId ? slugsById.get(parentId) : undefined,
        })),
    ]),
  );
}

export function resolveClassificationChange(
  change: ClassificationReplyChange,
  editionKey: string | undefined,
  event: SavedEvent | undefined,
  terms: Terms,
) {
  const savedTerms =
    event?.editions.find((edition) => edition.editionKey === editionKey)
      ?.terms ?? [];
  const unknown: string[] = [];
  const ids = classificationFacets.flatMap(([field, facet]) => {
    const selection = change.value[field];
    if (selection == null) {
      return savedTerms
        .filter((term) => term.facet === facet)
        .map((term) => term.id);
    }
    const slugs = typeof selection === "string" ? [selection] : selection;
    return slugs.flatMap((slug) => {
      const term = terms.find(
        (term) => term.facet === facet && term.slug === slug,
      );
      if (!term) {
        unknown.push(`${field} ${JSON.stringify(slug)}`);
        return [];
      }
      return [term.id];
    });
  });
  if (unknown.length) {
    throw new Error(
      `Unknown classification slugs in ${unknown.join(", ")}. Use only slugs for each facet from the supplied vocabulary.`,
    );
  }
  if (ids.length > maxClassificationTerms) {
    throw new Error(
      `Classification allows at most ${maxClassificationTerms} terms across all facets.`,
    );
  }
  return { ...change, value: ids };
}

export function materializeClassificationReply(
  reply: ClassificationReply,
  targets: Targets | null,
  event: SavedEvent | undefined,
  terms: Terms,
): ClassificationOutput {
  const output: ClassificationOutput = {
    ...reply,
    previousEdition: null,
    currentOrNextEdition: null,
  };
  for (const name of editionSlotNames) {
    const slot = reply[name];
    if (slot === null) {
      continue;
    }
    output[name] = slot.classification
      ? {
          classification: resolveClassificationChange(
            slot.classification,
            targets?.[name]?.editionKey,
            event,
            terms,
          ),
        }
      : {};
  }
  return output;
}

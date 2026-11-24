import { check } from "../../checks";
import type { CatalogChanges } from "../../changes";

export function included2027Terms(changes: CatalogChanges, terms: string[]) {
  return terms.map((term, index) =>
    check(
      `catalog.edition.2027.terms.set.${index + 1}`,
      changes.edition(
        { year: 2027 },
        "terms",
        (value) => value?.includes(term) === true,
      ),
      `Include ${term} in 2027 classification`,
    ),
  );
}

export function preserveEventFields(changes: CatalogChanges) {
  return [
    check(
      "catalog.event.descriptions.preserve.1",
      !changes.event("description", () => true) &&
        !changes.event("short_description", () => true),
      "Preserve both Event descriptions",
    ),
    check(
      "catalog.event.links.preserve.2",
      !changes.event("links", (value) => value != null),
      "Preserve Event links",
    ),
  ];
}

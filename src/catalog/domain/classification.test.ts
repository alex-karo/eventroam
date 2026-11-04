import { expect, test } from "vitest";
import {
  normalizeProposedAssignments,
  validateTaxonomyTerm,
  validateTermAssignments,
} from "./classification";
import { facets } from "./vocabulary";

test("taxonomy checks the facet vocabulary", () => {
  for (const facet of facets) {
    validateTaxonomyTerm({ id: "term", facet });
  }
  expect(() => validateTaxonomyTerm({ id: "term", facet: "future" })).toThrow();
});

test("taxonomy validates both sides of an edited parent relation", () => {
  const parent = { id: "parent", facet: "genre" };
  const child = { id: "child", facet: "genre", parentId: "parent" };
  validateTaxonomyTerm(child, parent);
  validateTaxonomyTerm(parent, undefined, [child]);
  expect(() => validateTaxonomyTerm(child)).toThrow(/parent/);
  expect(() =>
    validateTaxonomyTerm({ ...child, facet: "topic" }, parent),
  ).toThrow(/same facet/);
  expect(() =>
    validateTaxonomyTerm({ ...parent, facet: "topic" }, undefined, [child]),
  ).toThrow(/same facet/);
});

test.each(["event_type", "format"])(
  "only one %s assignment is allowed",
  (facet) => {
    validateTermAssignments([{ id: "one", facet }]);
    expect(() =>
      validateTermAssignments([
        { id: "one", facet },
        { id: "two", facet },
      ]),
    ).toThrow(/Only one/);
  },
);

test("proposal normalization checks the event type limit before removing ancestors", () => {
  const parent = { id: "parent", facet: "event_type" };
  const child = { id: "child", facet: "event_type", parentId: parent.id };
  expect(() =>
    normalizeProposedAssignments([parent.id, child.id], [parent, child]),
  ).toThrow("Only one event_type term allowed");
});

test("multiple topic, genre and culture assignments remain allowed", () => {
  validateTermAssignments(
    ["topic", "genre", "culture"].flatMap((facet) => [
      { id: `${facet}-1`, facet },
      { id: `${facet}-2`, facet },
    ]),
  );
});

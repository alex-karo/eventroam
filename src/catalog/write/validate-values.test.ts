import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { validateCatalogValues } from "./validate-values";

test("taxonomy record validation loads children before accepting a changed facet", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const parent = fx.term({ facet: "genre" });
  fx.term({ facet: "genre", parentId: parent.id });
  expect(() =>
    client.transaction(() => {
      validateCatalogValues(client, "taxonomy_terms", {
        ...parent,
        facet: "topic",
      });
      client
        .prepare("UPDATE taxonomy_terms SET facet='topic' WHERE id=?")
        .run(parent.id);
    })(),
  ).toThrow(/children must be in same facet/);
  expect(
    client
      .prepare("SELECT facet FROM taxonomy_terms WHERE id=?")
      .get(parent.id),
  ).toEqual({ facet: "genre" });
});

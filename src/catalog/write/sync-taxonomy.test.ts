import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import vocabulary from "@/catalog/taxonomy.json";
import { openReadDatabase } from "@/db/connection";
import { editionTerms, taxonomyTerms } from "@/db/schema";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { syncTaxonomy } from "./sync-taxonomy";

test("the vocabulary covers the starter keys and adds two topics", () => {
  const { db } = testDatabase();
  const terms = db.select().from(taxonomyTerms).all();
  const slugsById = new Map(terms.map(({ id, slug }) => [id, slug]));
  expect(vocabulary).toHaveLength(terms.length + 2);
  for (const { facet, slug, name, parentId } of terms) {
    const entry = vocabulary.find(
      (entry) => entry.facet === facet && entry.slug === slug,
    );
    expect(entry?.name).toBe(name);
    expect(entry?.parentSlug).toBe(slugsById.get(parentId ?? ""));
  }
});

test("preview and apply agree and preserve imported taxonomy and assignments", () => {
  const connection = testDatabase();
  const { client, db, path } = connection;
  const fx = testFixtures(client);
  db.delete(taxonomyTerms).where(eq(taxonomyTerms.slug, "jazz")).run();
  const parent = fx.term({ facet: "genre", slug: "local-genre" });
  const imported = fx.term({
    id: "imported-jazz",
    facet: "genre",
    slug: "jazz",
    name: "Imported Jazz",
    description: "Old description",
    parentId: parent.id,
  });
  fx.assignTerm(fx.edition(fx.event()), imported);
  const assignments = db.select().from(editionTerms).all();
  const before = db.select().from(taxonomyTerms).all();
  const read = openReadDatabase(path);
  const preview = (() => {
    try {
      return syncTaxonomy(read, vocabulary, false);
    } finally {
      read.client.close();
    }
  })();
  expect(db.select().from(taxonomyTerms).all()).toEqual(before);
  expect(syncTaxonomy(connection, vocabulary, true)).toEqual(preview);

  const terms = db.select().from(taxonomyTerms).all();
  const food = terms.find(({ slug }) => slug === "food-and-drink");
  expect(food).toBeDefined();
  for (const slug of ["wine", "beer"]) {
    expect(
      terms.find((term) => term.facet === "topic" && term.slug === slug),
    ).toMatchObject({ parentId: food!.id, description: expect.any(String) });
  }
  expect(terms).toEqual(
    expect.arrayContaining([
      parent,
      { ...imported, name: "Jazz", description: null },
    ]),
  );
  expect(db.select().from(editionTerms).all()).toEqual(assignments);
  expect(preview.parentDifferences).toEqual([
    {
      term: "genre/jazz",
      storedParent: "genre/local-genre",
      declaredParent: null,
    },
  ]);
  expect(syncTaxonomy(connection, vocabulary, true)).toEqual({
    additions: [],
    updates: [],
    parentDifferences: preview.parentDifferences,
  });
});

const newTopic = { facet: "topic", slug: "new-topic", name: "New topic" };

test("sync adds a new parent before its child", () => {
  const connection = testDatabase();
  const child = { ...newTopic, slug: "new-child", parentSlug: newTopic.slug };
  const { additions } = syncTaxonomy(connection, [child, newTopic], true);
  expect(additions.map(({ slug }) => slug)).toEqual(["new-topic", "new-child"]);
  expect(additions[1].parentId).toBe(additions[0].id);
});

test.each([
  { entries: [newTopic, newTopic], error: /Duplicate.*topic\/new-topic/ },
  {
    entries: [{ ...newTopic, parentSlug: "missing" }],
    error: /Unknown.*topic\/missing/,
  },
  {
    entries: [{ ...newTopic, parentSlug: newTopic.slug }],
    error: /cycle.*topic\/new-topic/,
  },
  { entries: [{ ...newTopic, description: "  " }], error: /description/ },
])(
  "invalid taxonomy input leaves the catalog unchanged ($error)",
  ({ entries, error }) => {
    const connection = testDatabase();
    const { db } = connection;
    const before = db.select().from(taxonomyTerms).all();
    expect(() =>
      syncTaxonomy(connection, [...vocabulary, ...entries], true),
    ).toThrow(error);
    expect(db.select().from(taxonomyTerms).all()).toEqual(before);
  },
);

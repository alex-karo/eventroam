import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  applyCatalogItem,
  applyCatalogOperation,
} from "@/catalog/write/apply-operation";
import type { CatalogOperation } from "@/catalog/operations/operation";

const count = (
  client: ReturnType<typeof testDatabase>["client"],
  table: string,
) =>
  (client.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n;

test("old Occurrence operation names, owners and fields fail before writes", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const snapshot = () =>
    [
      "events",
      "editions",
      "external_links",
      "catalog_changes",
      "operation_receipts",
    ].map((table) => client.prepare(`SELECT * FROM ${table}`).all());
  const before = snapshot();
  for (const payload of [
    {
      kind: "createOccurrence",
      eventId: event.id,
      data: { occurrenceKey: "2028" },
    },
    ...["updateOccurrence", "publishOccurrence", "withdrawOccurrence"].map(
      (kind) => ({
        kind,
        id: edition.id,
        expectedVersion: 1,
        ...(kind === "updateOccurrence" ? { data: {} } : {}),
      }),
    ),
    {
      kind: "replaceLinks",
      owner: { type: "occurrence", id: edition.id },
      expectedVersion: 1,
      links: [],
    },
    {
      kind: "createEdition",
      eventId: event.id,
      data: { occurrenceKey: "2028" },
    },
    {
      kind: "updateEdition",
      id: edition.id,
      expectedVersion: 1,
      data: { occurrenceYear: 2028 },
    },
    {
      kind: "updateEdition",
      occurrenceId: edition.id,
      expectedVersion: 1,
      data: {},
    },
  ]) {
    expect(() =>
      applyCatalogOperation(client, {
        operationKey: "old-contract",
        actor: "owner",
        ...payload,
      } as CatalogOperation),
    ).toThrow();
    expect(snapshot()).toEqual(before);
  }
});

test("renamed payload cannot reuse a historical receipt and Edition retries replay", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const edition = fx.edition(fx.event());
  const legacy = {
    operationKey: "historical-update",
    actor: "owner",
    kind: "updateOccurrence",
    id: edition.id,
    expectedVersion: 1,
    data: { occurrenceYear: 2028 },
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(legacy))
    .digest("hex");
  const savedResult = '{"id":"old-edition","version":2,"changed":true}';
  client
    .prepare("INSERT INTO operation_receipts VALUES(?,?,?,?)")
    .run(legacy.operationKey, hash, savedResult, "2026-10-01");
  const operation: CatalogOperation = {
    operationKey: legacy.operationKey,
    actor: "owner",
    kind: "updateEdition",
    id: edition.id,
    expectedVersion: 1,
    data: { editionYear: 2028 },
  };
  const receipt = client.prepare("SELECT * FROM operation_receipts").get();
  expect(() => applyCatalogOperation(client, operation)).toThrow(
    /different payload/,
  );
  expect(client.prepare("SELECT * FROM operation_receipts").get()).toEqual(
    receipt,
  );
  expect(count(client, "catalog_changes")).toBe(0);
  expect(
    client.prepare("SELECT version FROM editions WHERE id=?").get(edition.id),
  ).toEqual({ version: 1 });
  const current = { ...operation, operationKey: "edition-update" };
  const result = applyCatalogOperation(client, current);
  expect(applyCatalogOperation(client, current)).toEqual(result);
  expect(count(client, "catalog_changes")).toBe(1);
});

test("term replacement rejects assigned ancestors at every depth atomically", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const sibling = fx.edition(event);
  const parent = fx.term();
  const child = fx.term({ parentId: parent.id });
  const leaf = fx.term({ parentId: child.id });
  fx.assignTerm(edition, leaf);
  fx.assignTerm(sibling, parent);
  const snapshot = () => ({
    editions: client.prepare("SELECT * FROM editions").all(),
    assignments: client.prepare("SELECT * FROM edition_terms").all(),
    changes: client.prepare("SELECT * FROM catalog_changes").all(),
    receipts: client.prepare("SELECT * FROM operation_receipts").all(),
  });
  const before = snapshot();
  for (const ancestor of [child, parent]) {
    expect(() =>
      applyCatalogOperation(client, {
        kind: "replaceTerms",
        operationKey: `terms:ancestor:${ancestor.id}`,
        actor: "owner",
        id: edition.id,
        expectedVersion: edition.version,
        termIds: [ancestor.id, leaf.id],
      }),
    ).toThrow(/redundant ancestor/);
    expect(snapshot()).toEqual(before);
  }
  const noOp = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: "terms:descendant-only",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    termIds: [leaf.id],
  });
  expect(noOp.changed).toBe(false);
});

test("ordinary edition updates reject legacy price fields without altering a saved price block", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.edition(fx.event(), {
    priceKind: "exact",
    priceCurrency: "EUR",
    priceMinMinor: 10000,
    priceMaxMinor: 10000,
    priceCoverage: "full_programme",
    priceDetails: [{ label: "Regular", amount: 100, currency: "EUR" }],
  });
  const snapshot = () => ({
    editions: client.prepare("SELECT * FROM editions").all(),
    changes: client.prepare("SELECT * FROM catalog_changes").all(),
    receipts: client.prepare("SELECT * FROM operation_receipts").all(),
  });
  const before = snapshot();
  for (const price of [
    null,
    undefined,
    {
      kind: "exact",
      currency: "EUR",
      minMinor: 20000,
      maxMinor: 20000,
      coverage: "full_programme",
    },
  ]) {
    expect(() =>
      applyCatalogOperation(client, {
        kind: "updateEdition",
        operationKey: "price:legacy-update",
        actor: "owner",
        id: edition.id,
        expectedVersion: edition.version,
        data: { displayName: "Must not change", price },
      } as CatalogOperation),
    ).toThrow(/Unrecognized key/);
    expect(snapshot()).toEqual(before);
  }
});

test("postponement preserves previous dates and only changes its edition", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.publishedEdition(event, {
    editionKey: "2027",
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  const other = fx.publishedEdition(event, {
    editionKey: "2025",
    startsOn: "2025-07-01",
  });
  const result = applyCatalogOperation(client, {
    kind: "updateEdition",
    operationKey: "test:postpone",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: { scheduleStatus: "postponed" },
  });
  expect(result.version).toBe(edition.version + 1);
  expect(
    client
      .prepare(
        "SELECT starts_on,ends_on,schedule_status FROM editions WHERE id=?",
      )
      .get(edition.id),
  ).toMatchObject({
    starts_on: "2027-07-01",
    ends_on: "2027-07-03",
    schedule_status: "postponed",
  });
  expect(
    (
      client
        .prepare("SELECT version FROM editions WHERE id=?")
        .get(other.id) as { version: number }
    ).version,
  ).toBe(other.version);
});

test("invalid changes roll back, stale writes fail, replay is idempotent and payload mismatch fails", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const old = fx.publishedEdition(event, {
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateEdition",
      operationKey: "test:invalid",
      actor: "owner",
      id: old.id,
      expectedVersion: old.version,
      data: { startsOn: null },
    }),
  ).toThrow();
  const op = {
    kind: "updateEdition" as const,
    operationKey: "test:valid",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { sizeEstimate: 1200 },
  };
  const applied = applyCatalogOperation(client, op);
  expect(applied.changed).toBe(true);
  expect(applyCatalogOperation(client, op)).toEqual(applied);
  expect(count(client, "catalog_changes")).toBe(1);
  expect(() =>
    applyCatalogOperation(client, { ...op, data: { sizeEstimate: 1300 } }),
  ).toThrow(/different payload/);
  expect(() =>
    applyCatalogOperation(client, { ...op, operationKey: "test:stale" }),
  ).toThrow(/Stale/);
});

test("create audit keeps supplied field order, arrays, and omitted defaults", () => {
  const client = testDatabase().client;
  const event = applyCatalogOperation(client, {
    kind: "createEvent",
    operationKey: "audit:create-event",
    actor: "owner",
    data: {
      slug: "array-festival",
      canonicalName: "Array Festival",
      aliases: ["Array Fest"],
      summary: undefined,
    },
  });
  const edition = applyCatalogOperation(client, {
    kind: "createEdition",
    operationKey: "audit:create-edition",
    actor: "owner",
    eventId: event.id,
    data: {
      editionKey: "2028",
      displayName: null,
      price: {
        kind: "free",
        minMinor: 0,
        maxMinor: 0,
        coverage: "full_programme",
      },
      locality: "Test field",
      dateState: undefined,
    },
  });
  const fields = (key: string) => {
    const row = client
      .prepare(
        "SELECT changed_fields FROM catalog_changes WHERE operation_key=?",
      )
      .get(key) as { changed_fields: string };
    return JSON.parse(row.changed_fields) as Array<{
      field: string;
      oldPresent: boolean;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
  const eventFields = fields("audit:create-event");
  expect(eventFields.map((change) => change.field)).toEqual([
    "id",
    "slug",
    "canonical_name",
    "aliases",
    "home_scope",
    "publication_state",
    "version",
    "created_at",
    "updated_at",
  ]);
  expect(
    eventFields.find((change) => change.field === "aliases")?.newValue,
  ).toEqual(["Array Fest"]);
  expect(
    eventFields.every(
      (change) => !change.oldPresent && change.oldValue === null,
    ),
  ).toBe(true);
  const editionFields = fields("audit:create-edition");
  expect(editionFields.map((change) => change.field)).toEqual([
    "id",
    "event_id",
    "edition_key",
    "display_name",
    "locality",
    "price_kind",
    "price_currency",
    "price_min_minor",
    "price_max_minor",
    "price_coverage",
    "price_qualification",
    "publication_state",
    "date_state",
    "schedule_status",
    "coordinate_precision",
    "version",
    "created_at",
    "updated_at",
  ]);
  expect(
    editionFields.find((change) => change.field === "display_name")?.newValue,
  ).toBeNull();
  expect(
    editionFields.every(
      (change) => !change.oldPresent && change.oldValue === null,
    ),
  ).toBe(true);
  expect(edition.version).toBe(1);
  expect(
    applyCatalogOperation(client, {
      kind: "updateEvent",
      operationKey: "audit:same-aliases",
      actor: "owner",
      id: event.id,
      expectedVersion: event.version,
      data: { aliases: ["Array Fest"] },
    }),
  ).toEqual({ id: event.id, version: 1, changed: false });
});

test("publication gates dates, country and facets; withdrawal retains URL reservation", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ slug: "test-field-days" });
  const termIds = fx.festivalTerms().map((term) => term.id);
  const draft = applyCatalogOperation(client, {
    kind: "createEdition",
    operationKey: "test:draft",
    actor: "owner",
    eventId: event.id,
    data: {
      editionKey: "2028",
      dateState: "unknown",
      countryCode: "PT",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishEdition",
      operationKey: "test:publish-undated",
      actor: "owner",
      id: draft.id,
      expectedVersion: draft.version,
    }),
  ).toThrow(/Publication needs/);
  let updated = applyCatalogOperation(client, {
    kind: "updateEdition",
    operationKey: "test:dates",
    actor: "owner",
    id: draft.id,
    expectedVersion: draft.version,
    data: {
      editionYear: 2028,
      startsOn: "2028-07-01",
      endsOn: "2028-07-03",
      dateState: "provisional",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishEdition",
      operationKey: "test:publish-no-terms",
      actor: "owner",
      id: draft.id,
      expectedVersion: updated.version,
    }),
  ).toThrow(/event type/);
  updated = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: "test:terms",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
    termIds,
  });
  const published = applyCatalogOperation(client, {
    kind: "publishEdition",
    operationKey: "test:publish",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
  });
  expect(published.changed).toBe(true);
  fx.publishEvent(event);
  const withdrawn = applyCatalogOperation(client, {
    kind: "withdrawEdition",
    operationKey: "test:withdraw",
    actor: "owner",
    id: draft.id,
    expectedVersion: published.version,
  });
  expect(withdrawn.changed).toBe(true);
  expect(
    client
      .prepare("SELECT path FROM url_aliases WHERE edition_id=?")
      .get(draft.id),
  ).toMatchObject({ path: "/events/test-field-days/2028" });
});

test("publication accepts unknown format with complete required facts and saved links", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event, { locality: null });
  for (const term of [
    fx.term({ facet: "event_type", slug: "conference" }),
    fx.term({ facet: "culture", slug: "participatory" }),
  ]) {
    fx.assignTerm(edition, term);
  }
  fx.editionLink(edition, {
    kind: "ticketing",
    url: "https://example.org/2027/tickets#offers",
  });
  const operation: CatalogOperation = {
    kind: "publishEdition",
    operationKey: "publish:with-link",
    actor: "catalog-agent",
    initiatedBy: "owner",
    id: edition.id,
    expectedVersion: edition.version,
  };
  const result = applyCatalogOperation(client, operation);
  expect(result).toMatchObject({ changed: true, version: edition.version + 1 });
  expect(applyCatalogOperation(client, operation)).toEqual(result);
  expect(count(client, "catalog_changes")).toBe(1);
  expect(() =>
    applyCatalogOperation(client, {
      ...operation,
      operationKey: "publish:stale-with-link",
    }),
  ).toThrow(/Stale subject version/);
});

test("published event rename reserves old and new paths, including editions", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const { event } = fx.publishedEvent({
    event: { slug: "test-field-days" },
    editions: [{ editionKey: "2027" }],
  });
  const id = event.id;
  const aliasesBefore = count(client, "url_aliases");
  applyCatalogOperation(client, {
    kind: "updateEvent",
    operationKey: "test:rename",
    actor: "owner",
    id,
    expectedVersion: event.version,
    data: { slug: "fictional-new-name" },
  });
  expect(count(client, "url_aliases")).toBe(aliasesBefore + 2);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "test:reuse",
      actor: "owner",
      data: { slug: "test-field-days", canonicalName: "Other" },
    }),
  ).toThrow(/Event slug "test-field-days" has a public URL reserved/);
});

test("new Event slug collision identifies the slug", () => {
  const client = testDatabase().client;
  testFixtures(client).event({ slug: "same-festival" });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "test:duplicate-event-slug",
      actor: "owner",
      data: { slug: "same-festival", canonicalName: "Separate Festival" },
    }),
  ).toThrow(/Event slug "same-festival" is already used by another Event/);
});

test("typed price, size, coordinates, and area rules reject unsupported values", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.publishedEdition(event, {
    countryCode: "PT",
    latitude: null,
    longitude: null,
    coordinatePrecision: "unknown",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "replacePriceBlock",
      operationKey: "test:bad-price",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      priceDetails: [],
      basePrice: {
        kind: "range",
        currency: "EUR",
        minMinor: 5000,
        maxMinor: 4000,
        coverage: "full_programme",
      },
    }),
  ).toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateEdition",
      operationKey: "test:bad-coordinates",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { latitude: 0, coordinatePrecision: "approximate" },
    }),
  ).toThrow(/Coordinate pair/);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateEdition",
      operationKey: "test:bad-area",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { countryCode: null },
    }),
  ).toThrow(/country/);
  const before = client.prepare("SELECT * FROM editions").all();
  for (const sizeEstimate of [0, -1, 1.5, "8000"]) {
    expect(() =>
      applyCatalogOperation(client, {
        kind: "updateEdition",
        operationKey: "test:invalid-size",
        actor: "owner",
        id: edition.id,
        expectedVersion: edition.version,
        data: { sizeEstimate },
      } as never),
    ).toThrow();
  }
  expect(client.prepare("SELECT * FROM editions").all()).toEqual(before);
  expect(count(client, "catalog_changes")).toBe(0);
  expect(count(client, "operation_receipts")).toBe(0);
  const changed = applyCatalogItem(client, [
    {
      kind: "updateEdition",
      operationKey: "test:size",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { sizeEstimate: 1200 },
    },
    {
      kind: "replacePriceBlock",
      operationKey: "test:price",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      priceDetails: [],
      basePrice: {
        kind: "from",
        currency: "EUR",
        minMinor: 6500,
        maxMinor: 6500,
        coverage: "full_programme",
        qualification: "Early tier; fees unknown",
      },
    },
  ]);
  expect(changed.operations.every((result) => result.changed)).toBe(true);
  expect(changed.operations.map((result) => result.version)).toEqual([
    edition.version + 1,
    edition.version + 2,
  ]);
  expect(
    client
      .prepare("SELECT price_currency,price_min_minor FROM editions WHERE id=?")
      .get(edition.id),
  ).toMatchObject({ price_currency: "EUR", price_min_minor: 6500 });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateEdition",
      operationKey: "test:unassigned-country",
      actor: "owner",
      id: edition.id,
      expectedVersion: changed.operations[1].version,
      data: { countryCode: "ZZ" },
    }),
  ).toThrow(/ISO 3166-1/);
});

test("identical link replacement is a no-op and an added link preserves existing identity", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const id = event.id;
  const initialVersion = event.version;
  const first = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-first",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: initialVersion,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
    ],
  });
  const existing = client
    .prepare("SELECT id,created_at FROM external_links WHERE event_id=?")
    .get(id) as { id: string; created_at: string };
  const repeated = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-repeat",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: first.version,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
    ],
  });
  expect(repeated).toEqual({ id, version: first.version, changed: false });
  const added = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-add",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: repeated.version,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
      {
        kind: "instagram",
        url: "https://instagram.com/example",
        official: true,
      },
    ],
  });
  expect(added.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT id,created_at FROM external_links WHERE kind='official_site' AND event_id=?",
      )
      .get(id),
  ).toEqual(existing);
});

test("X links accept both account domains and reject a twitter kind alias", () => {
  const client = testDatabase().client;
  const event = testFixtures(client).event();
  const written = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:x-links",
    actor: "owner",
    owner: { type: "event", id: event.id },
    expectedVersion: event.version,
    links: [
      { kind: "x", url: "https://x.com/eventroam", official: true },
      { kind: "x", url: "https://twitter.com/eventroam", official: true },
    ],
  });
  expect(written.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT url FROM external_links WHERE event_id=? AND kind='x' ORDER BY url",
      )
      .all(event.id),
  ).toEqual([
    { url: "https://twitter.com/eventroam" },
    { url: "https://x.com/eventroam" },
  ]);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "replaceLinks",
      operationKey: "test:twitter-alias",
      actor: "owner",
      owner: { type: "event", id: event.id },
      expectedVersion: written.version,
      links: [
        {
          kind: "twitter",
          url: "https://twitter.com/eventroam",
          official: true,
        },
      ],
    } as unknown as CatalogOperation),
  ).toThrow();
});

test("link replacement audits changes and leaves unchanged links alone", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  fx.eventLink(event, { url: "https://example.org/" });
  const operation: CatalogOperation = {
    kind: "replaceLinks",
    operationKey: "links:added",
    actor: "catalog-agent",
    initiatedBy: "owner",
    owner: { type: "event", id: event.id },
    expectedVersion: event.version,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
      {
        kind: "instagram",
        url: "https://instagram.com/example",
        official: true,
      },
    ],
  };
  const added = applyCatalogOperation(client, operation);
  expect(added.changed).toBe(true);
  expect(applyCatalogOperation(client, operation)).toEqual(added);
  const unchanged = applyCatalogOperation(client, {
    ...operation,
    operationKey: "links:unchanged",
    expectedVersion: added.version,
  });
  expect(unchanged).toEqual({
    id: event.id,
    version: added.version,
    changed: false,
  });
  expect(
    client
      .prepare("SELECT count(*) n FROM catalog_changes WHERE event_id=?")
      .get(event.id),
  ).toEqual({ n: 1 });
});

test("item dry run rolls back dependent creates and publication", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const termIds = fx.festivalTerms().map((term) => term.id);
  const operations: CatalogOperation[] = [
    {
      kind: "createEvent",
      tempKey: "event",
      operationKey: "item:event",
      actor: "owner",
      data: { slug: "item-festival", canonicalName: "Item Festival" },
    },
    {
      kind: "createEdition",
      tempKey: "edition",
      operationKey: "item:edition",
      actor: "owner",
      eventId: "$event",
      data: {
        editionKey: "2028",
        editionYear: 2028,
        startsOn: "2028-07-01",
        endsOn: "2028-07-03",
        dateState: "confirmed",
        countryCode: "PT",
        locality: "Example Valley",
      },
    },
    {
      kind: "replaceTerms",
      operationKey: "item:terms",
      actor: "owner",
      id: "$edition",
      expectedVersion: 1,
      termIds,
    },
    {
      kind: "publishEdition",
      operationKey: "item:publish-edition",
      actor: "owner",
      id: "$edition",
      expectedVersion: 2,
    },
    {
      kind: "publishEvent",
      operationKey: "item:publish-event",
      actor: "owner",
      id: "$event",
      expectedVersion: 1,
    },
  ];
  const before = [
    "events",
    "editions",
    "catalog_changes",
    "operation_receipts",
  ].map((table) => count(client, table));
  const preview = applyCatalogItem(client, operations, {
    dryRun: true,
  });
  expect(preview.operations.map((result) => result.changed)).toEqual([
    true,
    true,
    true,
    true,
    true,
  ]);
  expect(preview.changes).toHaveLength(5);
  expect(
    ["events", "editions", "catalog_changes", "operation_receipts"].map(
      (table) => count(client, table),
    ),
  ).toEqual(before);
  const applied = applyCatalogItem(client, operations);
  expect(applied.operations.map((result) => result.changed)).toEqual(
    preview.operations.map((result) => result.changed),
  );
  expect(
    applied.changes.map((change) =>
      change.changedFields.map((field) => field.field),
    ),
  ).toEqual(
    preview.changes.map((change) =>
      change.changedFields.map((field) => field.field),
    ),
  );
  expect(applyCatalogItem(client, operations).operations).toEqual(
    applied.operations,
  );
});

test("item rollback and complete price replacement preserve atomic state", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.publishedEdition(event);
  const first = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:first",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    priceDetails: [
      {
        label: "Weekend",
        amount: 180,
        currency: "EUR",
        availability: "available",
        url: "https://example.org/tickets",
      },
    ],
    basePrice: {
      kind: "exact",
      minMinor: 18000,
      maxMinor: 18000,
      currency: "EUR",
      coverage: "full_programme",
    },
  });
  expect(first.changed).toBe(true);
  const reordered = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:recheck",
    actor: "owner",
    id: edition.id,
    expectedVersion: first.version,
    priceDetails: [
      { label: "Friday", amount: 70, currency: "EUR" },
      {
        label: "Weekend",
        amount: 180,
        currency: "EUR",
        availability: "available",
        url: "https://example.org/tickets",
      },
    ],
    basePrice: null,
  });
  expect(reordered.changed).toBe(true);
  const noOp = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:order",
    actor: "owner",
    id: edition.id,
    expectedVersion: reordered.version,
    priceDetails: [
      {
        label: "Weekend",
        amount: 180,
        currency: "EUR",
        availability: "available",
        url: "https://example.org/tickets",
      },
      { label: "Friday", amount: 70, currency: "EUR" },
    ],
    basePrice: null,
  });
  expect(noOp.changed).toBe(false);
  const state = client
    .prepare("SELECT price_details,price_kind,version FROM editions WHERE id=?")
    .get(edition.id);
  expect(() =>
    applyCatalogItem(client, [
      {
        kind: "replacePriceBlock",
        operationKey: "item:clear",
        actor: "owner",
        id: edition.id,
        expectedVersion: reordered.version,
        priceDetails: [],
        basePrice: null,
      },
      {
        kind: "updateEdition",
        operationKey: "item:bad",
        actor: "owner",
        id: edition.id,
        expectedVersion: reordered.version,
        data: { startsOn: null },
      },
    ]),
  ).toThrow(/Date pair is incomplete/);
  expect(
    client
      .prepare(
        "SELECT price_details,price_kind,version FROM editions WHERE id=?",
      )
      .get(edition.id),
  ).toEqual(state);
  const cleared = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:clear",
    actor: "owner",
    id: edition.id,
    expectedVersion: reordered.version,
    priceDetails: [],
    basePrice: null,
  });
  expect(cleared.changed).toBe(true);
  expect(
    client
      .prepare("SELECT price_details,price_kind FROM editions WHERE id=?")
      .get(edition.id),
  ).toEqual({ price_details: "[]", price_kind: null });
});

test("audit records attribution and receipts reject changed payloads", () => {
  const client = testDatabase().client;
  const edition = testFixtures(client).publishedEdition(
    testFixtures(client).event(),
  );
  const operation: CatalogOperation = {
    kind: "updateEdition",
    operationKey: "audit:size",
    actor: "catalog-agent",
    initiatedBy: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: { sizeEstimate: 1200 },
  };
  const applied = applyCatalogOperation(client, operation);
  expect(applied.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT actor,initiated_by,changed_fields FROM catalog_changes WHERE operation_key='audit:size'",
      )
      .get(),
  ).toEqual({
    actor: "catalog-agent",
    initiated_by: "owner",
    changed_fields: JSON.stringify([
      {
        field: "size_estimate",
        oldPresent: true,
        oldValue: null,
        newValue: 1200,
      },
    ]),
  });
  expect(applyCatalogOperation(client, operation)).toEqual(applied);
  expect(() =>
    applyCatalogOperation(client, {
      ...operation,
      data: { sizeEstimate: 1300 },
    }),
  ).toThrow(/different payload/);
  expect(() =>
    applyCatalogOperation(client, {
      ...operation,
      operationKey: "audit:stale",
    }),
  ).toThrow(/Stale subject version/);
});

test("item applies successive operations with the latest subject version", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.publishedEdition(fx.event());
  const results = applyCatalogItem(client, [
    {
      kind: "updateEdition",
      operationKey: "versions:size",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { sizeEstimate: 1200 },
    },
    {
      kind: "updateEdition",
      operationKey: "versions:venue",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { venueName: "New field" },
    },
  ]);
  expect(results.operations.map((result) => result.version)).toEqual([
    edition.version + 1,
    edition.version + 2,
  ]);
  expect(
    client
      .prepare(
        "SELECT version,size_estimate,venue_name FROM editions WHERE id=?",
      )
      .get(edition.id),
  ).toEqual({
    version: edition.version + 2,
    size_estimate: 1200,
    venue_name: "New field",
  });
});

test("price variants validate amount and currency together and preserve audit values", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.publishedEdition(fx.event());
  const base: CatalogOperation = {
    kind: "replacePriceBlock",
    operationKey: "price:invalid",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    priceDetails: [{ label: "Weekend", amount: 180 }],
    basePrice: null,
  };
  expect(() => applyCatalogOperation(client, base)).toThrow(
    /Amount and currency/,
  );
  expect(() =>
    applyCatalogOperation(client, {
      ...base,
      priceDetails: [{ label: "Weekend", amount: -1, currency: "EUR" }],
    }),
  ).toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      ...base,
      priceDetails: [{ label: "Weekend", amount: 180, currency: "ZZZ" }],
    }),
  ).toThrow(/Unknown ISO currency/);
  const applied = applyCatalogOperation(client, {
    ...base,
    priceDetails: [
      {
        label: "Weekend",
        amount: 180,
        currency: "EUR",
        terms: "Camping extra",
      },
    ],
  });
  expect(applied.changed).toBe(true);
  const change = client
    .prepare(
      "SELECT changed_fields FROM catalog_changes WHERE operation_key='price:invalid'",
    )
    .get() as { changed_fields: string };
  expect(JSON.parse(change.changed_fields)).toContainEqual(
    expect.objectContaining({
      field: "price_details",
      oldValue: [],
      newValue: [
        {
          label: "Weekend",
          amount: 180,
          currency: "EUR",
          terms: "Camping extra",
        },
      ],
    }),
  );
  expect(() =>
    applyCatalogOperation(client, {
      ...base,
      priceDetails: [{ label: "Weekend", amount: 181, currency: "EUR" }],
    }),
  ).toThrow(/different payload/);
});

test("price removal records old and new values without requiring a note", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.publishedEdition(fx.event());
  const added = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:seed",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    priceDetails: [{ label: "Weekend", amount: 120, currency: "EUR" }],
    basePrice: {
      kind: "exact",
      minMinor: 12000,
      maxMinor: 12000,
      currency: "EUR",
      coverage: "full_programme",
    },
  });
  const result = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "price:clear",
    actor: "catalog-agent",
    initiatedBy: "owner",
    id: edition.id,
    expectedVersion: added.version,
    priceDetails: [],
    basePrice: null,
  });
  expect(result.changed).toBe(true);
  const audit = client
    .prepare(
      "SELECT actor,initiated_by,changed_fields FROM catalog_changes WHERE operation_key='price:clear'",
    )
    .get() as { actor: string; initiated_by: string; changed_fields: string };
  expect(audit.actor).toBe("catalog-agent");
  expect(audit.initiated_by).toBe("owner");
  expect(JSON.parse(audit.changed_fields)).toContainEqual(
    expect.objectContaining({ field: "price_details", newValue: [] }),
  );
  expect(JSON.parse(audit.changed_fields)).toContainEqual(
    expect.objectContaining({ field: "price_kind", newValue: null }),
  );
});

test.each([
  {
    name: "date state",
    data: {
      startsOn: null,
      endsOn: null,
      dateState: undefined,
      scheduleStatus: "announced" as const,
    },
    error: /Date state conflicts/,
  },
  {
    name: "schedule status",
    data: {
      startsOn: null,
      endsOn: null,
      dateState: "unknown" as const,
      scheduleStatus: undefined,
    },
    error: /Scheduled edition needs dates/,
  },
  {
    name: "coordinate precision",
    data: { latitude: null, longitude: null, coordinatePrecision: undefined },
    error: /Coordinate precision conflicts/,
  },
])(
  "undefined $name cannot bypass final-record validation",
  ({ data, error }) => {
    const { client } = testDatabase();
    const fx = testFixtures(client);
    const edition = fx.edition(fx.event(), {
      latitude: 38,
      longitude: -9,
      coordinatePrecision: "exact",
    });
    const snapshot = () => ({
      editions: client.prepare("SELECT * FROM editions").all(),
      changes: client.prepare("SELECT * FROM catalog_changes").all(),
      receipts: client.prepare("SELECT * FROM operation_receipts").all(),
    });
    const before = snapshot();
    expect(() =>
      applyCatalogOperation(client, {
        kind: "updateEdition",
        operationKey: "invalid:undefined",
        actor: "test",
        id: edition.id,
        expectedVersion: edition.version,
        data,
      }),
    ).toThrow(error);
    expect(snapshot()).toEqual(before);
  },
);

test("updates containing only undefined fields are idempotent no-ops", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const snapshot = () => ({
    events: client.prepare("SELECT * FROM events").all(),
    editions: client.prepare("SELECT * FROM editions").all(),
    changes: client.prepare("SELECT * FROM catalog_changes").all(),
  });
  const before = snapshot();
  const operations = [
    {
      kind: "updateEvent",
      operationKey: "undefined:event",
      actor: "test",
      id: event.id,
      expectedVersion: event.version,
      data: { slug: undefined, aliases: undefined, summary: undefined },
    },
    {
      kind: "updateEdition",
      operationKey: "undefined:edition",
      actor: "test",
      id: edition.id,
      expectedVersion: edition.version,
      data: {
        startsOn: undefined,
        dateState: undefined,
        scheduleStatus: undefined,
        coordinatePrecision: undefined,
      },
    },
  ] satisfies CatalogOperation[];
  for (const op of operations) {
    const result = applyCatalogOperation(client, op);
    expect(result).toEqual({
      id: op.id,
      version: op.expectedVersion,
      changed: false,
    });
    expect(applyCatalogOperation(client, op)).toEqual(result);
    expect(snapshot()).toEqual(before);
  }
  // Successful no-ops still receive their normal idempotency receipts.
  expect(count(client, "operation_receipts")).toBe(2);
});

test("partial updates preserve undefined fields and audit only actual changes", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const edition = fx.edition(fx.event(), {
    priceKind: "exact",
    priceCurrency: "EUR",
    priceMinMinor: 12000,
    priceMaxMinor: 12000,
    priceCoverage: "full_programme",
  });
  const changed = applyCatalogOperation(client, {
    kind: "updateEdition",
    operationKey: "undefined:mixed",
    actor: "test",
    id: edition.id,
    expectedVersion: edition.version,
    data: {
      displayName: "Updated edition",
      dateState: undefined,
    },
  });
  expect(changed).toEqual({
    id: edition.id,
    version: edition.version + 1,
    changed: true,
  });
  const audit = client
    .prepare("SELECT changed_fields FROM catalog_changes WHERE operation_key=?")
    .get("undefined:mixed") as { changed_fields: string };
  expect(JSON.parse(audit.changed_fields)).toEqual([
    expect.objectContaining({
      field: "display_name",
      newValue: "Updated edition",
    }),
  ]);
  expect(
    client
      .prepare(
        "SELECT date_state, price_kind, price_min_minor FROM editions WHERE id=?",
      )
      .get(edition.id),
  ).toEqual({
    date_state: "confirmed",
    price_kind: "exact",
    price_min_minor: 12000,
  });
});

test("an explicit empty price block clears variants and every stored price field", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const edition = fx.edition(fx.event(), {
    priceKind: "exact",
    priceCurrency: "EUR",
    priceMinMinor: 12000,
    priceMaxMinor: 12000,
    priceCoverage: "full_programme",
    priceQualification: "Fees included",
    priceDetails: [{ label: "Regular", amount: 120, currency: "EUR" }],
  });
  applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "undefined:clear-price",
    actor: "test",
    id: edition.id,
    expectedVersion: edition.version,
    basePrice: null,
    priceDetails: [],
  });
  expect(
    client
      .prepare(
        "SELECT price_kind, price_currency, price_min_minor, price_max_minor, price_coverage, price_qualification, price_details FROM editions WHERE id=?",
      )
      .get(edition.id),
  ).toEqual({
    price_kind: null,
    price_currency: null,
    price_min_minor: null,
    price_max_minor: null,
    price_coverage: null,
    price_qualification: null,
    price_details: "[]",
  });
});

test("merged-record validation rolls back writes, versions, audit and receipts", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const parent = fx.event();
  const edition = fx.edition(parent);
  const snapshot = () => ({
    editions: client.prepare("SELECT * FROM editions").all(),
    changes: client.prepare("SELECT * FROM catalog_changes").all(),
    receipts: client.prepare("SELECT * FROM operation_receipts").all(),
  });
  const before = snapshot();
  for (const data of [
    { startsOn: null, endsOn: null },
    { dateState: "unknown" as const },
    { latitude: 38, longitude: -9 },
  ]) {
    expect(() =>
      applyCatalogOperation(client, {
        kind: "updateEdition",
        operationKey: "invalid:merged",
        actor: "test",
        id: edition.id,
        expectedVersion: edition.version,
        data,
      }),
    ).toThrow();
    expect(snapshot()).toEqual(before);
  }
  // The new DB intentionally permits unknown statuses. The writer still checks
  // the complete final record, even when the operation only replaces its price.
  client
    .prepare("UPDATE editions SET schedule_status='future' WHERE id=?")
    .run(edition.id);
  const corrupted = snapshot();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "replacePriceBlock",
      operationKey: "invalid:price",
      actor: "test",
      id: edition.id,
      expectedVersion: edition.version,
      basePrice: {
        kind: "free",
        minMinor: 0,
        maxMinor: 0,
        coverage: "full_programme",
      },
      priceDetails: [],
    }),
  ).toThrow();
  expect(snapshot()).toEqual(corrupted);
});

test("removed edition and link fields are rejected without catalog writes", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.edition(event);
  const operations = [
    {
      kind: "updateEdition",
      id: edition.id,
      expectedVersion: edition.version,
      data: { capacityEstimate: 8000 },
    },
    {
      kind: "createEdition",
      eventId: event.id,
      data: { editionKey: "2028", ticketAvailability: "sold_out" },
    },
    {
      kind: "updateEdition",
      id: edition.id,
      expectedVersion: edition.version,
      data: { ticketAvailability: "closed" },
    },
    {
      kind: "replaceLinks",
      owner: { type: "event", id: event.id },
      expectedVersion: event.version,
      links: [
        {
          kind: "official_site",
          url: "https://example.org",
          official: true,
          sourceId: "source",
        },
      ],
    },
  ];
  for (const [index, operation] of operations.entries()) {
    expect(() =>
      applyCatalogOperation(client, {
        ...operation,
        actor: "owner",
        operationKey: `removed-field:${index}`,
      } as CatalogOperation),
    ).toThrow(/Unrecognized key/);
  }
  expect(count(client, "editions")).toBe(1);
  for (const table of [
    "external_links",
    "catalog_changes",
    "operation_receipts",
  ]) {
    expect(count(client, table)).toBe(0);
  }
  expect(
    client.prepare("SELECT version FROM editions WHERE id=?").get(edition.id),
  ).toEqual({ version: edition.version });
});

test("free variants persist zero without currency and retain an idempotent receipt", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.publishedEdition(fx.event());
  const op: CatalogOperation = {
    kind: "replacePriceBlock",
    operationKey: "free-concession",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    priceDetails: [{ label: "Personal assistant", amount: 0 }],
    basePrice: null,
  };
  const applied = applyCatalogOperation(client, op);
  expect(applied.changed).toBe(true);
  const row = client
    .prepare("SELECT price_details, price_kind FROM editions WHERE id=?")
    .get(edition.id) as { price_details: string; price_kind: string | null };
  expect(JSON.parse(row.price_details)).toEqual([
    { label: "Personal assistant", amount: 0 },
  ]);
  expect(row.price_kind).toBeNull();
  expect(applyCatalogOperation(client, op)).toEqual(applied);
  expect(() =>
    applyCatalogOperation(client, {
      ...op,
      operationKey: "currency-only",
      priceDetails: [{ label: "Unknown", currency: "EUR" }],
    }),
  ).toThrow(/Amount and currency/);
});

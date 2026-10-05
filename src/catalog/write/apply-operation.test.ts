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

test("postponement preserves previous dates and only changes its edition", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.publishedOccurrence(event, {
    occurrenceKey: "2027",
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  const other = fx.publishedOccurrence(event, {
    occurrenceKey: "2025",
    startsOn: "2025-07-01",
  });
  const result = applyCatalogOperation(client, {
    kind: "updateOccurrence",
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
        "SELECT starts_on,ends_on,schedule_status FROM occurrences WHERE id=?",
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
        .prepare("SELECT version FROM occurrences WHERE id=?")
        .get(other.id) as { version: number }
    ).version,
  ).toBe(other.version);
});

test("invalid changes roll back, stale writes fail, replay is idempotent and payload mismatch fails", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const old = fx.publishedOccurrence(event, {
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:invalid",
      actor: "owner",
      id: old.id,
      expectedVersion: old.version,
      data: { startsOn: null },
    }),
  ).toThrow();
  const op = {
    kind: "updateOccurrence" as const,
    operationKey: "test:valid",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { capacityEstimate: 1200 },
  };
  const applied = applyCatalogOperation(client, op);
  expect(applied.changed).toBe(true);
  expect(applyCatalogOperation(client, op)).toEqual(applied);
  expect(count(client, "catalog_changes")).toBe(1);
  expect(() =>
    applyCatalogOperation(client, { ...op, data: { capacityEstimate: 1300 } }),
  ).toThrow(/different payload/);
  expect(() =>
    applyCatalogOperation(client, { ...op, operationKey: "test:stale" }),
  ).toThrow(/Stale/);
});

test("publication gates dates, area and scope; withdrawal retains URL reservation", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ slug: "test-field-days" });
  fx.festivalTerms();
  const draft = applyCatalogOperation(client, {
    kind: "createOccurrence",
    operationKey: "test:draft",
    actor: "owner",
    eventId: event.id,
    data: {
      occurrenceKey: "2028",
      dateState: "unknown",
      countryCode: "PT",
      locality: "Example Valley",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-undated",
      actor: "owner",
      id: draft.id,
      expectedVersion: draft.version,
    }),
  ).toThrow(/Publication needs/);
  let updated = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:dates",
    actor: "owner",
    id: draft.id,
    expectedVersion: draft.version,
    data: {
      occurrenceYear: 2028,
      startsOn: "2028-07-01",
      endsOn: "2028-07-03",
      dateState: "provisional",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-no-terms",
      actor: "owner",
      id: draft.id,
      expectedVersion: updated.version,
    }),
  ).toThrow(/format/);
  updated = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: "test:terms",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
    termIds: ["test-festival", "test-outdoor", "test-music"],
  });
  const published = applyCatalogOperation(client, {
    kind: "publishOccurrence",
    operationKey: "test:publish",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
  });
  expect(published.changed).toBe(true);
  fx.publishEvent(event);
  const withdrawn = applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "test:withdraw",
    actor: "owner",
    id: draft.id,
    expectedVersion: published.version,
  });
  expect(withdrawn.changed).toBe(true);
  expect(
    client
      .prepare("SELECT path FROM url_aliases WHERE occurrence_id=?")
      .get(draft.id),
  ).toMatchObject({ path: "/events/test-field-days/2028" });
});

test("publication accepts structurally complete editions with saved links", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.occurrence(event);
  for (const term of fx.festivalTerms()) fx.assignTerm(edition, term);
  fx.occurrenceLink(edition, {
    kind: "ticketing",
    url: "https://example.org/2027/tickets#offers",
  });
  const operation: CatalogOperation = {
    kind: "publishOccurrence",
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
    occurrences: [{ occurrenceKey: "2027" }],
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
  ).toThrow(/reserved/);
});

test("typed price, capacity, coordinates, and area rules reject unsupported values", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  const edition = fx.publishedOccurrence(event, {
    countryCode: "PT",
    latitude: null,
    longitude: null,
    coordinatePrecision: "unknown",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-price",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: {
        price: {
          kind: "range",
          currency: "EUR",
          minMinor: 5000,
          maxMinor: 4000,
          coverage: "full_programme",
        },
      },
    }),
  ).toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-coordinates",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { latitude: 0, coordinatePrecision: "approximate" },
    }),
  ).toThrow(/Coordinate pair/);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-area",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { countryCode: null },
    }),
  ).toThrow(/country/);
  const changed = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:price",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: {
      capacityEstimate: 1200,
      price: {
        kind: "from",
        currency: "EUR",
        minMinor: 6500,
        maxMinor: 6500,
        coverage: "full_programme",
        qualification: "Early tier; fees unknown",
      },
    },
  });
  expect(changed.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT price_currency,price_min_minor FROM occurrences WHERE id=?",
      )
      .get(edition.id),
  ).toMatchObject({ price_currency: "EUR", price_min_minor: 6500 });
  expect(() =>
    client
      .prepare("UPDATE occurrences SET latitude=1 WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare("UPDATE occurrences SET price_coverage=NULL WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind='free',price_currency=NULL,price_min_minor=NULL,price_max_minor=0,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind='free',price_currency=NULL,price_min_minor=0,price_max_minor=0,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("UPDATE occurrences SET price_kind=NULL WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind=NULL,price_currency='EUR',price_min_minor=100,price_max_minor=100,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind=NULL,price_currency=NULL,price_min_minor=NULL,price_max_minor=NULL,price_coverage=NULL,price_qualification=NULL WHERE id=?",
      )
      .run(edition.id),
  ).not.toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:unassigned-country",
      actor: "owner",
      id: edition.id,
      expectedVersion: changed.version,
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
  fx.festivalTerms();
  const operations: CatalogOperation[] = [
    {
      kind: "createEvent",
      tempKey: "event",
      operationKey: "item:event",
      actor: "owner",
      data: { slug: "item-festival", canonicalName: "Item Festival" },
    },
    {
      kind: "createOccurrence",
      tempKey: "edition",
      operationKey: "item:edition",
      actor: "owner",
      eventId: "$event",
      data: {
        occurrenceKey: "2028",
        occurrenceYear: 2028,
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
      termIds: ["test-festival", "test-outdoor", "test-music"],
    },
    {
      kind: "publishOccurrence",
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
    "occurrences",
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
    ["events", "occurrences", "catalog_changes", "operation_receipts"].map(
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
  const edition = fx.publishedOccurrence(event);
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
    .prepare(
      "SELECT price_details,price_kind,version FROM occurrences WHERE id=?",
    )
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
        kind: "updateOccurrence",
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
        "SELECT price_details,price_kind,version FROM occurrences WHERE id=?",
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
      .prepare("SELECT price_details,price_kind FROM occurrences WHERE id=?")
      .get(edition.id),
  ).toEqual({ price_details: "[]", price_kind: null });
});

test("audit records attribution and receipts reject changed payloads", () => {
  const client = testDatabase().client;
  const edition = testFixtures(client).publishedOccurrence(
    testFixtures(client).event(),
  );
  const operation: CatalogOperation = {
    kind: "updateOccurrence",
    operationKey: "audit:capacity",
    actor: "catalog-agent",
    initiatedBy: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: { capacityEstimate: 1200 },
  };
  const applied = applyCatalogOperation(client, operation);
  expect(applied.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT actor,initiated_by,changed_fields FROM catalog_changes WHERE operation_key='audit:capacity'",
      )
      .get(),
  ).toEqual({
    actor: "catalog-agent",
    initiated_by: "owner",
    changed_fields: JSON.stringify([
      {
        field: "capacity_estimate",
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
      data: { capacityEstimate: 1300 },
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
  const edition = fx.publishedOccurrence(fx.event());
  const results = applyCatalogItem(client, [
    {
      kind: "updateOccurrence",
      operationKey: "versions:capacity",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { capacityEstimate: 1200 },
    },
    {
      kind: "updateOccurrence",
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
        "SELECT version,capacity_estimate,venue_name FROM occurrences WHERE id=?",
      )
      .get(edition.id),
  ).toEqual({
    version: edition.version + 2,
    capacity_estimate: 1200,
    venue_name: "New field",
  });
});

test("price variants validate amount and currency together and preserve audit values", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const edition = fx.publishedOccurrence(fx.event());
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
  const edition = fx.publishedOccurrence(fx.event());
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

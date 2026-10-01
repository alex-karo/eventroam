import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { seedDevelopmentFixtures } from "../db/development-fixtures";
import { applyCatalogOperation } from "./catalog";
import {
  publicEvent,
  publicList,
  resolvePublicPath,
  selectActive,
} from "./public-catalog";
import { siteForHost, siteOrigins } from "./public-site";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-public-"));
  const { client, db } = openDatabase(join(dir, "catalog.sqlite"));
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  cleanup.push(() => {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const id = seedDevelopmentFixtures(client);
  return { client, id };
}
const evidence = (fields: string[]) => [
  {
    sourceId: "dev-source-official",
    inspectedUrl: "https://example.org/fictional-festival",
    retrievedAt: "2026-10-01T12:00:00Z",
    authority: "official" as const,
    fieldPaths: fields,
    excerpt: "Fictional evidence",
  },
];

test("upcoming list and active selection use only current public editions", () => {
  const { client, id } = setup();
  const list = publicList(client, "2026-10-01");
  expect(list.map((o) => o.key)).toEqual(["2027"]);
  expect(list[0]).toMatchObject({
    dateState: "provisional",
    hasCoordinates: false,
    locality: "Example Valley",
  });
  const event = publicEvent(client, id)!;
  expect(event.editions.map((o) => o.key)).toEqual([
    "2027",
    "2026-cancelled",
    "2025",
  ]);
  expect(selectActive(event.editions, "2026-10-01")?.key).toBe("2027");
  expect(selectActive(event.editions, "2028-01-01")).toBeNull();
  expect(JSON.stringify(event)).not.toMatch(
    /sourceId|operationKey|catalog_changes|retrievedAt|dev-source-official/,
  );
});

test("published history and postponement retain pages but leave upcoming list", () => {
  const { client } = setup();
  const old = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string; version: number };
  applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "public:postpone",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { scheduleStatus: "postponed" },
    evidence: evidence(["schedule_status"]),
  });
  expect(publicList(client, "2026-10-01")).toEqual([]);
  expect(
    resolvePublicPath(client, "/events/fictional-field-days/2027")?.edition
      ?.status,
  ).toBe("postponed");
  expect(
    resolvePublicPath(client, "/events/fictional-field-days/2026-cancelled")
      ?.edition?.status,
  ).toBe("cancelled");
  expect(
    resolvePublicPath(client, "/events/fictional-field-days/2025")?.edition
      ?.key,
  ).toBe("2025");
});

test("renamed addresses redirect by stored identity and hidden targets fail", () => {
  const { client, id } = setup();
  const event = client
    .prepare("SELECT version FROM events WHERE id=?")
    .get(id) as { version: number };
  applyCatalogOperation(client, {
    kind: "updateEvent",
    operationKey: "public:rename",
    actor: "owner",
    id,
    expectedVersion: event.version,
    data: { slug: "fictional-new-name" },
    evidence: evidence(["slug"]),
  });
  expect(
    resolvePublicPath(client, "/events/fictional-field-days")?.redirect,
  ).toBe(true);
  expect(
    resolvePublicPath(client, "/events/fictional-field-days/2027")?.redirect,
  ).toBe(true);
  expect(
    resolvePublicPath(client, "/events/fictional-new-name/2027")?.redirect,
  ).toBe(false);
  expect(resolvePublicPath(client, "/events/missing")).toBeNull();
  const edition = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string; version: number };
  applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "public:withdraw",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
  });
  expect(
    resolvePublicPath(client, "/events/fictional-field-days/2027"),
  ).toBeNull();
  expect(
    resolvePublicPath(client, "/events/fictional-new-name/2027"),
  ).toBeNull();
  expect(publicList(client, "2026-10-01")).toEqual([]);
  client
    .prepare("UPDATE events SET publication_state='withdrawn' WHERE id=?")
    .run(id);
  expect(resolvePublicPath(client, "/events/fictional-field-days")).toBeNull();
  expect(publicEvent(client, id)).toBeNull();
});

test("scope hosts are allowlisted and canonical origins are configured", () => {
  const origins = siteOrigins({
    PUBLIC_APEX_ORIGIN: "https://eventroam.example",
    PUBLIC_FESTIVALS_ORIGIN: "https://festivals.eventroam.example",
  });
  expect(siteForHost("festivals.eventroam.example", origins)).toBe("festivals");
  expect(siteForHost("eventroam.example", origins)).toBe("apex");
  expect(siteForHost("unconfigured.example", origins)).toBeNull();
});

test("official links inherit by kind and private links and evidence stay outside public reads", () => {
  const { client, id } = setup();
  const edition = client
    .prepare("SELECT id FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string };
  const now = "2026-10-01T12:00:00Z";
  const insert = client.prepare(
    "INSERT INTO external_links(id,event_id,occurrence_id,kind,url,label,official,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  insert.run(
    "parent-site",
    id,
    null,
    "official_site",
    "https://example.org/parent",
    null,
    1,
    now,
    now,
  );
  insert.run(
    "edition-site",
    null,
    edition.id,
    "official_site",
    "https://example.org/edition",
    "Edition site",
    1,
    now,
    now,
  );
  insert.run(
    "private-social",
    null,
    edition.id,
    "instagram",
    "https://example.org/private",
    null,
    0,
    now,
    now,
  );
  const read = resolvePublicPath(
    client,
    "/events/fictional-field-days/2027",
  )!.edition!;
  expect(read.links).toEqual([
    {
      kind: "official_site",
      url: "https://example.org/edition",
      label: "Edition site",
    },
  ]);
  expect(JSON.stringify(read)).not.toContain("example.org/private");
});

test("a published Event with no published edition has no public route", () => {
  const { client, id } = setup();
  client
    .prepare(
      "UPDATE occurrences SET publication_state='withdrawn' WHERE event_id=?",
    )
    .run(id);
  expect(publicEvent(client, id)).toBeNull();
  expect(resolvePublicPath(client, "/events/fictional-field-days")).toBeNull();
});

test("complete compact discovery includes history and unlocated editions, excluding cancelled", async () => {
  const { discoveryCatalog } = await import("./discovery-catalog");
  const { filterSummaries, parseFilters } = await import("./discovery");
  const { client } = setup();
  const catalog = discoveryCatalog(client);
  expect(catalog.summaries.map((s) => s.key).sort()).toEqual(["2025", "2027"]);
  expect(
    catalog.summaries.every((s) => s.latitude === null && s.longitude === null),
  ).toBe(true);
  expect(JSON.stringify(catalog)).not.toMatch(
    /price|sourceId|retrievedAt|evidence|venueAddress|summary/,
  );
  const filters = parseFilters(
    new URLSearchParams(
      "from=2025-07-03&to=2025-07-03&country=PT&durationMin=3",
    ),
    catalog.genres,
  );
  const serverResults = filterSummaries(
    catalog.summaries,
    filters,
    catalog.genres,
    new Date("2026-10-01T12:00:00Z"),
  );
  const browserResults = filterSummaries(
    JSON.parse(JSON.stringify(catalog.summaries)),
    filters,
    JSON.parse(JSON.stringify(catalog.genres)),
    new Date("2026-10-01T12:00:00Z"),
  );
  expect(serverResults.map((s) => s.key)).toEqual(["2025"]);
  expect(browserResults).toEqual(serverResults);
});

import { expect, test } from "vitest";
import { catalogEditSchema } from "@/catalog/operations/direct-edit";
import { resolvePublicPath } from "@/catalog/read/public-catalog";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { applyCatalogEdit, verifyEditPreview } from "./direct-edit";
import { editionRow, eventRow } from "./apply-operation";

test("Edition dates can change with null links and no Edition links", () => {
  const { client } = testDatabase();
  const fixtures = testFixtures(client);
  const event = fixtures.event();
  fixtures.eventLink(event);
  const edition = fixtures.edition(event, {
    editionYear: null,
    startsOn: null,
    endsOn: null,
  });
  const savedLinks = client.prepare("SELECT * FROM external_links").all();
  const after = {
    editionYear: 2026,
    startsOn: "2026-07-07",
    endsOn: "2026-07-19",
    dateState: "confirmed",
    scheduleStatus: "scheduled",
  };
  const edit = catalogEditSchema.parse({
    auditMode: "record",
    targets: [
      {
        kind: "edition",
        id: edition.id,
        links: null,
        changes: {
          editionYear: { before: null, after: after.editionYear },
          startsOn: { before: null, after: after.startsOn },
          endsOn: { before: null, after: after.endsOn },
          dateState: { before: "unknown", after: after.dateState },
          scheduleStatus: {
            before: "announced",
            after: after.scheduleStatus,
          },
        },
      },
    ],
  });
  verifyEditPreview(client, edit);
  expect(
    applyCatalogEdit(client, edit, { runId: "dates", toolCallId: "dates" }),
  ).toEqual([{ kind: "edition", id: edition.id, status: "changed" }]);
  expect(editionRow(client, edition.id)).toMatchObject(after);
  expect(client.prepare("SELECT * FROM external_links").all()).toEqual(
    savedLinks,
  );
  expect(
    client.prepare("SELECT count(*) FROM catalog_changes").pluck().get(),
  ).toBe(1);
});

test("null links preserves links while a nullable field can be cleared", () => {
  const { client } = testDatabase();
  const fixtures = testFixtures(client);
  const event = fixtures.event({ shortDescription: "Old text" });
  const link = fixtures.eventLink(event);
  const edit = catalogEditSchema.parse({
    auditMode: "record",
    targets: [
      {
        kind: "event",
        id: event.id,
        links: null,
        changes: { shortDescription: { before: "Old text", after: null } },
      },
    ],
  });
  verifyEditPreview(client, edit);
  expect(
    applyCatalogEdit(client, edit, { runId: "clear", toolCallId: "clear" })[0]
      .status,
  ).toBe("changed");
  expect(eventRow(client, event.id).shortDescription).toBeNull();
  expect(client.prepare("SELECT id FROM external_links").all()).toEqual([
    { id: link.id },
  ]);
});

test("approved targets are independent and an unaudited slug edit keeps aliases and receipts", () => {
  const { client } = testDatabase();
  const fixtures = testFixtures(client);
  const { event } = fixtures.publishedEvent();
  const other = fixtures.event();
  const link = fixtures.eventLink(other);
  const edit = catalogEditSchema.parse({
    auditMode: "omit",
    targets: [
      {
        kind: "event",
        id: event.id,
        changes: { slug: { before: event.slug, after: "new-slug" } },
      },
      {
        kind: "event",
        id: other.id,
        changes: {
          description: {
            before: other.description,
            after: "Changed description",
          },
        },
        links: [
          {
            id: link.id,
            changes: { label: { before: link.label, after: "New label" } },
          },
        ],
      },
    ],
  });
  const pair = { runId: "run", toolCallId: "call" };
  verifyEditPreview(client, edit);
  client.prepare("DELETE FROM external_links WHERE id = ?").run(link.id);
  const results = applyCatalogEdit(client, edit, pair);
  expect(results.map(({ status }) => status)).toEqual(["changed", "failed"]);
  expect(eventRow(client, other.id)).toEqual(other);
  expect(resolvePublicPath(client, `/events/${event.slug}`)).toMatchObject({
    event: { id: event.id, slug: "new-slug" },
    redirect: true,
  });
  expect(client.prepare("SELECT 1 FROM catalog_changes").all()).toEqual([]);
  expect(applyCatalogEdit(client, edit, pair)).toEqual(results);
  expect(eventRow(client, event.id).version).toBe(event.version + 1);
  expect(
    applyCatalogEdit(client, { ...edit, auditMode: "record" }, pair)[0]?.status,
  ).toBe("failed");
});

import { expect, test } from "vitest";
import { catalogEditSchema } from "@/catalog/operations/direct-edit";
import { resolvePublicPath } from "@/catalog/read/public-catalog";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { applyCatalogEdit, verifyEditPreview } from "./direct-edit";
import { eventRow } from "./apply-operation";

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

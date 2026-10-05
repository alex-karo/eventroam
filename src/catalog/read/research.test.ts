import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { applyCatalogOperation } from "@/catalog/write/apply-operation";
import {
  readResearchCatalog,
  readResearchEvent,
} from "@/catalog/read/research";

test("private research context retains drafts, links, classification, variants and audit attribution", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Private Festival" });
  const edition = fx.occurrence(event, { occurrenceKey: "2028" });
  fx.festivalTerms();
  fx.assignTerm(edition, { id: "test-festival" });
  fx.eventLink(event, { url: "https://example.org", kind: "official_site" });
  const result = applyCatalogOperation(client, {
    kind: "replacePriceBlock",
    operationKey: "private:price",
    actor: "catalog-agent",
    initiatedBy: "owner",
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
  const context = readResearchEvent(client, event.id);
  expect(context?.publicationState).toBe("draft");
  expect(context?.links.map((link) => link.url)).toContain(
    "https://example.org",
  );
  expect(context?.editions[0].version).toBe(result.version);
  expect(context?.editions[0].terms.map((term) => term.id)).toContain(
    "test-festival",
  );
  expect(context?.editions[0].priceDetails).toEqual([
    { label: "Weekend", amount: 120, currency: "EUR" },
  ]);
  expect(context?.editions[0].changes[0]).toMatchObject({
    actor: "catalog-agent",
    initiatedBy: "owner",
    changedFields: expect.any(Array),
  });
  expect(readResearchCatalog(client).map((item) => item.id)).toContain(
    event.id,
  );
});

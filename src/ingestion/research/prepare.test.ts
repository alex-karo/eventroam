import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import type { CatalogResearchInput } from "../workflow";
import type { ResearchCandidate } from "./contracts";
import { prepareResearch } from "./prepare";

const input: CatalogResearchInput = {
  mode: "add",
  name: "Example Fest",
  actor: "catalog-research",
  initiatedBy: "owner",
};
const candidate = (): ResearchCandidate => ({
  eventName: "Example Fest",
  editions: [{ key: "2027", year: 2027, status: "announced" }],
  claims: [{ editionKey: "2027", field: "capacityEstimate", value: 1200 }],
  prices: [],
  links: [],
  observations: [],
});

test("accepts the model's factual proposal without reading or checking citations", () => {
  const client = testDatabase().client;
  const result = prepareResearch(
    candidate(),
    readResearchCatalog(client),
    input,
    [],
  );
  expect(result.gaps).toEqual([]);
  expect(result.operations.map((operation) => operation.kind)).toEqual([
    "createEvent",
    "createOccurrence",
  ]);
  expect(
    result.operations.every(
      (operation) => !("mode" in operation) && !("evidence" in operation),
    ),
  ).toBe(true);
});

test("rejects malformed answers and writes outside the requested Event", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const target = fx.event({ canonicalName: "Example Fest" });
  const other = fx.event({ canonicalName: "Other Fest" });
  const catalog = readResearchCatalog(client);
  const request = { ...input, mode: "refresh" as const, eventId: target.id };
  expect(
    prepareResearch({ ...candidate(), claims: "bad" }, catalog, request, [])
      .gaps[0].code,
  ).toBe("invalid_candidate");
  const wrong = prepareResearch(
    { ...candidate(), eventId: other.id },
    catalog,
    request,
    [],
  );
  expect(wrong.operations).toEqual([]);
  expect(wrong.gaps[0].code).toBe("ambiguous_identity");
});

test("unknown edition references and duplicate price blocks fail basic validation", () => {
  const client = testDatabase().client;
  const catalog = readResearchCatalog(client);
  const wrong = candidate();
  wrong.claims[0].editionKey = "2028";
  expect(prepareResearch(wrong, catalog, input, []).operations).toEqual([]);
  const repeated = candidate();
  repeated.prices = [
    { editionKey: "2027", priceDetails: [], basePrice: null },
    { editionKey: "2027", priceDetails: [], basePrice: null },
  ];
  expect(prepareResearch(repeated, catalog, input, []).gaps[0].code).toBe(
    "invalid_candidate",
  );
});

test("existing editions can be updated and newly announced editions can be created", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.occurrence(event, { occurrenceKey: "2027", occurrenceYear: 2027 });
  const catalog = readResearchCatalog(client);
  const proposal = { ...candidate(), eventId: event.id };
  const request = { ...input, mode: "refresh" as const, eventId: event.id };
  const accepted = prepareResearch(proposal, catalog, request, []);
  expect(
    accepted.operations.some(
      (operation) => operation.kind === "updateOccurrence",
    ),
  ).toBe(true);
  expect(
    accepted.operations.every(
      (operation) => operation.kind !== "createOccurrence",
    ),
  ).toBe(true);
  const next = prepareResearch(
    {
      ...proposal,
      editions: [
        ...proposal.editions,
        { key: "2028", year: 2028, status: "announced" },
      ],
    },
    catalog,
    request,
    [],
  );
  expect(
    next.operations.some((operation) => operation.kind === "createOccurrence"),
  ).toBe(true);
});

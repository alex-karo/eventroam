import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
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

test.each([
  ["Sónar", "sonar"],
  ["So\u0301nar", "sonar"],
  ["Ｆｅｓｔ ２０２７", "fest-2027"],
  [`${"a".repeat(99)} Festival`, "a".repeat(99)],
  ["音楽祭", /^event-[a-f0-9]{12}$/],
])(
  "adds %s with a valid ASCII slug and unchanged name",
  (eventName, expected) => {
    const client = testDatabase().client;
    const proposal = { ...candidate(), eventName };
    const result = prepareResearch(proposal, [], input, []);
    applyCatalogItem(client, result.operations);
    const [saved] = readResearchCatalog(client);
    expect(saved.canonicalName).toBe(eventName);
    if (typeof expected === "string") {
      expect(saved.slug).toBe(expected);
    } else {
      expect(saved.slug).toMatch(expected);
    }
    expect(
      prepareResearch(proposal, [], input, []).operations[0],
    ).toMatchObject({
      data: { slug: saved.slug },
    });
  },
);

test.each(["event", "occurrence"] as const)(
  "merges equivalent %s URLs without rolling back other changes",
  (owner) => {
    const client = testDatabase().client;
    const proposal = candidate();
    const link = {
      owner,
      ...(owner === "occurrence" ? { editionKey: "2027" } : {}),
      kind: "official_site" as const,
      url: "https://example.org/",
    };
    proposal.links = [link];
    const initial = prepareResearch(proposal, [], input, []);
    const saved = applyCatalogItem(client, initial.operations);
    const eventId = saved.references.event;
    const request = { ...input, mode: "refresh" as const, eventId };
    const update = {
      ...proposal,
      eventId,
      summary: "Updated description",
      links: [
        { ...link, url: "https://example.org" },
        { ...link, url: "https://EXAMPLE.org:443/#tickets" },
        { ...link, url: "https://example.org/?edition=2027" },
        { ...link, url: "https://example.org/?edition=2028" },
      ],
    };
    const prepared = prepareResearch(
      update,
      readResearchCatalog(client),
      request,
      [],
    );
    applyCatalogItem(client, prepared.operations);
    const [event] = readResearchCatalog(client);
    expect(event.summary).toBe(update.summary);
    const links = owner === "event" ? event.links : event.editions[0].links;
    expect(links.map(({ url }) => url).sort()).toEqual([
      "https://example.org/",
      "https://example.org/?edition=2027",
      "https://example.org/?edition=2028",
    ]);
    const repeat = prepareResearch(
      update,
      readResearchCatalog(client),
      request,
      [],
    );
    expect(applyCatalogItem(client, repeat.operations).changes).toEqual([]);
  },
);

test.each(["event", "occurrence"] as const)(
  "preserves saved %s link metadata when a recheck omits the label",
  (owner) => {
    const client = testDatabase().client;
    const fx = testFixtures(client);
    const event = fx.event({ canonicalName: "Example Fest" });
    const edition = fx.occurrence(event, {
      occurrenceKey: "2027",
      occurrenceYear: 2027,
    });
    const source = fx.source();
    const savedLink = {
      kind: "official_site" as const,
      url: "https://example.org/",
      label: "Official programme",
      official: true,
      sourceId: source.id,
    };
    if (owner === "event") {
      fx.eventLink(event, savedLink);
    } else {
      fx.occurrenceLink(edition, savedLink);
    }

    const proposal: ResearchCandidate = {
      eventId: event.id,
      eventName: "Example Fest",
      editions: [{ key: "2027", year: 2027, status: "announced" }],
      claims: [],
      prices: [],
      links: [
        {
          owner,
          ...(owner === "occurrence" ? { editionKey: "2027" } : {}),
          kind: "official_site",
          url: "https://EXAMPLE.org:443/#programme",
        },
      ],
      observations: [],
    };
    const request = { ...input, mode: "check" as const, eventId: event.id };
    const prepared = prepareResearch(
      proposal,
      readResearchCatalog(client),
      request,
      [],
    );
    expect(applyCatalogItem(client, prepared.operations).changes).toEqual([]);
    const [saved] = readResearchCatalog(client);
    const link =
      owner === "event" ? saved.links[0] : saved.editions[0].links[0];
    expect(link).toMatchObject({
      label: "Official programme",
      sourceId: source.id,
    });
  },
);

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

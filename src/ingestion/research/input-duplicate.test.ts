import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { findInputDuplicate, findInputNameCandidates } from "./input-duplicate";

const names = [
  {
    id: "fest",
    canonicalName: "Example Fest",
    aliases: ["Sample Party", "Example Fest"],
  },
  { id: "accent", canonicalName: "Fête du Lac", aliases: [] },
  { id: "unicode", canonicalName: "音楽祭", aliases: [] },
];

test.each([
  ["example fest, us", "fest", "Example Fest"],
  ["Please add (SAMPLE\n PARTY), us", "fest", "Sample Party"],
  ["Fe\u0302te du Lac, fr", "accent", "Fête du Lac"],
  ["音楽祭, jp", "unicode", "音楽祭"],
])(
  "finds a complete canonical name or alias in %s",
  (note, eventId, matchedName) => {
    expect(findInputNameCandidates(note, names).candidates).toEqual([
      { eventId, matchedName },
    ]);
  },
);

test.each([
  "Example, us",
  "Example Festivals, us",
  "MyExample Fest, us",
  "Example Festé, us",
  "Fete du Lac, fr",
  "別音楽祭, jp",
  "https://example.com/Example Fest",
  "https://example.com/Example%20Fest",
  "https://example.com/音楽祭",
])("does not use fragments, inferred aliases, or URL text in %s", (note) => {
  expect(findInputNameCandidates(note, names).candidates).toEqual([]);
});

test("keeps one candidate per Event and finds Events without saved links", () => {
  expect(
    findInputNameCandidates("Example Fest / Sample Party / Example Fest", names)
      .candidates,
  ).toEqual([{ eventId: "fest", matchedName: "Example Fest" }]);
});

test("keeps different Events with the same name", () => {
  const sameName = { ...names[0], id: "other" };
  expect(
    findInputNameCandidates("Example Fest", [
      ...names,
      sameName,
    ]).candidates.map(({ eventId }) => eventId),
  ).toEqual(["fest", "other"]);
});

function savedEvent(countries: (string | null)[] = ["US"]) {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({
    canonicalName: "Example Fest",
    aliases: ["Sample Party"],
  });
  for (const countryCode of countries) {
    fx.edition(event, { countryCode });
  }
  return { client, fx, event };
}

test.each([
  "example fest, us",
  "Sample Party; US",
  "Example Fest\nUS",
  "Please add Example Fest country: us",
  "Example Fest, us, [site](https://example.com/en/index)",
  "Example Fest, us, https://example.com/en/index",
  "Example Fest, [site](https://example.com/en/index), us",
])("uses name and country without requiring an exact URL: %s", (note) => {
  const { client, event } = savedEvent(["US", "US", null]);
  expect(findInputDuplicate(client, note)).toEqual({
    eventId: event.id,
    matchedName: note.startsWith("Sample") ? "Sample Party" : "Example Fest",
    support: { countryCode: "US" },
  });
});

test.each([
  "Example Fest",
  "Example Fest, United States",
  "Example Fest us",
  "Example Fest, zz",
  "Example Fest, gb",
  "Example Fest, us, gb",
  "Example Fest country: us; country: gb",
  "Example Fest https://example.com/us",
  "Example Fest, https://example.com/, usgb",
  "https://example.com/, us",
  "us",
])("continues research without clear, consistent support: %s", (note) => {
  const { client } = savedEvent();
  expect(findInputDuplicate(client, note)).toBeNull();
});

test("does not take a country code from a matched name", () => {
  const { client, fx } = savedEvent();
  const event = fx.event({ canonicalName: "US" });
  fx.edition(event, { countryCode: "US" });
  expect(findInputDuplicate(client, "US")).toBeNull();
  expect(findInputDuplicate(client, "US, us")).toBeNull();
});

test.each([
  "Example Fest, https://EXAMPLE.com",
  "Example Fest, [website](https://example.com/)",
  "Example Fest, [website](https://example.com/), extra",
  "Example Fest, [website](https://example.com/).",
  "Example Fest, [https://example.com/](https://example.com/)",
  "Example Fest <https://example.com/>",
  "Example Fest, us, https://example.com/",
])("uses a full official URL when country is unknown: %s", (note) => {
  const { client, fx, event } = savedEvent([null]);
  fx.eventLink(event, { url: "https://example.com/", official: true });
  expect(findInputDuplicate(client, note)).toEqual({
    eventId: event.id,
    matchedName: "Example Fest",
    support: { officialUrl: "https://example.com/" },
  });
});

test.each([
  "https://example.com/en/index",
  "http://example.com/",
  "https://www.example.com/",
  "https://example.com/?lang=en",
  "https://example.com/#about",
])("does not equate another full URL without country support: %s", (url) => {
  const { client, fx, event } = savedEvent();
  fx.eventLink(event, { url: "https://example.com/", official: true });
  expect(findInputDuplicate(client, `Example Fest ${url}`)).toBeNull();
});

test("a different page does not block a name-and-country match", () => {
  const { client, fx, event } = savedEvent();
  fx.eventLink(event, { url: "https://example.com/", official: true });
  expect(
    findInputDuplicate(client, "Example Fest, us, https://example.com/en/index")
      ?.support,
  ).toEqual({ countryCode: "US" });
});

test("only official Event links support a URL match, including social links", () => {
  const { client, fx, event } = savedEvent();
  fx.eventLink(event, { url: "https://example.com/", official: false });
  fx.editionLink(fx.edition(event, { countryCode: null }), {
    url: "https://edition.example/",
    official: true,
  });
  expect(
    findInputDuplicate(client, "Example Fest https://example.com/"),
  ).toBeNull();
  expect(
    findInputDuplicate(client, "Example Fest https://edition.example/"),
  ).toBeNull();
  fx.eventLink(event, {
    url: "https://social.example/fest",
    kind: "instagram",
    official: true,
  });
  expect(
    findInputDuplicate(client, "Example Fest https://social.example/fest")
      ?.support,
  ).toEqual({ officialUrl: "https://social.example/fest" });
});

test.each<{ countries: (string | null)[] }>([
  { countries: [] },
  { countries: [null] },
  { countries: ["GB"] },
  { countries: ["US", "GB"] },
])("saved countries $countries cannot support a US match", ({ countries }) => {
  const { client, fx, event } = savedEvent(countries);
  fx.eventLink(event, { url: "https://example.com/", official: true });
  expect(findInputDuplicate(client, "Example Fest, us")).toBeNull();
  if (countries.includes("GB")) {
    expect(
      findInputDuplicate(client, "Example Fest, us, https://example.com/"),
    ).toBeNull();
  }
});

test("unknown-country competitors block country support but an exact URL can resolve them", () => {
  const { client, fx, event } = savedEvent();
  const other = fx.event({ canonicalName: "Example Fest" });
  fx.edition(other, { countryCode: null });
  fx.eventLink(event, { url: "https://example.com/", official: true });
  expect(findInputDuplicate(client, "Example Fest, us")).toBeNull();
  expect(
    findInputDuplicate(client, "Example Fest, us, https://example.com/")
      ?.eventId,
  ).toBe(event.id);
  fx.eventLink(other, { url: "https://example.com/", official: true });
  expect(
    findInputDuplicate(client, "Example Fest, us, https://example.com/"),
  ).toBeNull();
});

test("country excludes known mismatches, but a conflicting exact URL cannot override it", () => {
  const { client, fx, event } = savedEvent();
  const other = fx.event({ canonicalName: "Example Fest" });
  fx.edition(other, { countryCode: "GB" });
  fx.eventLink(other, { url: "https://other.example/", official: true });
  expect(findInputDuplicate(client, "Example Fest, us")?.eventId).toBe(
    event.id,
  );
  expect(
    findInputDuplicate(client, "Example Fest, us, https://other.example/"),
  ).toBeNull();
});

test.each([
  ["https://other.example/", ", extra"],
  ["https://other.example/", "."],
  ["https://other.example/path_(part)", ", extra"],
])(
  "a Markdown URL conflict survives its wrapper and punctuation: %s%s",
  (url, suffix) => {
    const { client, fx } = savedEvent();
    const other = fx.event({ canonicalName: "Another Fest" });
    fx.eventLink(other, { url, official: true });
    expect(
      findInputDuplicate(
        client,
        `Example Fest, us, [Website](${url})${suffix}`,
      ),
    ).toBeNull();
  },
);

test("URL signals identify one named Event or continue research on conflict", () => {
  const { client, fx, event } = savedEvent();
  const other = fx.event({ canonicalName: "Another Fest" });
  fx.edition(other, { countryCode: "US" });
  fx.eventLink(event, { url: "https://example.com/", official: true });
  fx.eventLink(event, { url: "https://example.com/tickets", official: true });
  fx.eventLink(other, { url: "https://other.example/", official: true });
  expect(
    findInputDuplicate(
      client,
      "Example Fest https://example.com/ https://example.com/tickets",
    )?.eventId,
  ).toBe(event.id);
  expect(
    findInputDuplicate(client, "Example Fest, us, https://other.example/"),
  ).toBeNull();
  expect(
    findInputDuplicate(
      client,
      "Example Fest / Another Fest, us, https://example.com/ https://other.example/",
    ),
  ).toBeNull();
});

import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { publicEvent } from "./public-catalog";
import { similarFestivals } from "./similar-festivals";

test.each(["2027-06-01T12:00:00Z", "2027-07-02T12:00:00Z"])(
  "matches genres from the earliest source Edition that has not ended at %s",
  (now) => {
    const { client } = testDatabase();
    const fx = testFixtures(client);
    const hardstyle = fx.existingTerm("genre", "hardstyle");
    const metal = fx.existingTerm("genre", "metal");
    const source = fx.publishedEvent({
      editions: [
        { startsOn: "2027-07-01", endsOn: "2027-07-03" },
        { startsOn: "2027-08-01" },
      ],
    });
    fx.assignTerm(source.editions[0], hardstyle);
    fx.assignTerm(source.editions[1], metal);

    const match = fx.publishedEvent({
      editions: [{ startsOn: "2027-05-31" }, { startsOn: "2027-07-03" }],
    });
    fx.assignTerm(match.editions[0], hardstyle);
    fx.assignTerm(match.editions[1], hardstyle);
    const other = fx.publishedEvent();
    fx.assignTerm(other.editions[0], metal);

    const matches = similarFestivals(
      client,
      publicEvent(client, source.event.id)!,
      new Date(now),
    );
    expect(matches.map(({ edition }) => edition.id)).toEqual([
      match.editions[1].id,
    ]);
  },
);

test("uses the latest past source and ranks the first eligible match per Event", () => {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const hardstyle = fx.existingTerm("genre", "hardstyle");
  const hardTechno = fx.existingTerm("genre", "hard-techno");
  const deepHouse = fx.existingTerm("genre", "deep-house");
  const metal = fx.existingTerm("genre", "metal");
  const source = fx.publishedEvent({
    editions: [
      { startsOn: "2025-07-01" },
      { startsOn: "2026-07-01", scheduleStatus: "cancelled" },
    ],
  });
  fx.assignTerm(source.editions[0], metal);
  fx.assignTerm(source.editions[1], hardstyle);
  fx.assignTerm(source.editions[1], hardTechno);

  const broad = fx.publishedEvent({
    editions: [
      {
        startsOn: "2027-07-01",
        endsOn: "2027-07-05",
        soldOutSourceUrl: "https://example.org/sold-out",
      },
      { startsOn: "2027-07-02", endsOn: "2027-07-04" },
      {
        editionKey: "last-day",
        startsOn: "2027-07-03",
        countryCode: "US",
        timeZone: "America/Los_Angeles",
      },
      { editionKey: "later", startsOn: "2027-07-12" },
    ],
  });
  fx.assignTerm(broad.editions[0], hardstyle);
  fx.assignTerm(broad.editions[1], metal);
  fx.assignTerm(broad.editions[2], deepHouse);
  fx.assignTerm(broad.editions[3], hardstyle);

  const narrow = fx.publishedEvent({
    editions: [{ editionKey: "july", startsOn: "2027-07-05" }],
  });
  fx.assignTerm(narrow.editions[0], hardTechno);
  const sibling = fx.publishedEvent({
    editions: [{ editionKey: "summer", startsOn: "2027-07-06" }],
  });
  fx.assignTerm(
    sibling.editions[0],
    fx.existingTerm("genre", "melodic-techno"),
  );
  const fourth = fx.publishedEvent({
    editions: [{ editionKey: "fourth", startsOn: "2027-07-07" }],
  });
  fx.assignTerm(fourth.editions[0], deepHouse);

  const matches = similarFestivals(
    client,
    publicEvent(client, source.event.id)!,
    new Date("2027-07-04T00:30:00Z"),
  );
  expect(
    matches.map(({ edition, sharedGenreName }) => [
      edition.key,
      sharedGenreName,
    ]),
  ).toEqual([
    ["july", "Hard Techno"],
    ["summer", "Techno"],
    ["last-day", "Electronic"],
  ]);
});

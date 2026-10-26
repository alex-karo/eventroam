import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { publicEvent } from "@/catalog/read/public-catalog";
import { Dates, Location } from "./catalog";
import { dateRange } from "./format";
import { ExternalLinks, namedLinks } from "./external-links";
import { EditionDetailsPage } from "@/features/event-details/edition-page";
import { EventDetailsPage } from "@/features/event-details/event-page";

function event() {
  const client = testDatabase().client;
  const fixture = testFixtures(client).publishedEvent({
    event: { summary: "A general festival description." },
    editions: [
      { editionKey: "2027", startsOn: "2027-12-31", endsOn: "2028-01-01" },
      { editionKey: "2027-b", startsOn: "2027-01-01", endsOn: "2027-01-01" },
      {
        editionKey: "2025",
        startsOn: "2025-01-01",
        endsOn: "2025-01-01",
        scheduleStatus: "cancelled",
      },
    ],
  });
  return publicEvent(client, fixture.event.id)!;
}
test("facts have readable dates, inclusive duration, country names, and decorative icons", () => {
  const edition = event().editions[0];
  expect(renderToStaticMarkup(<Dates edition={edition} />)).toContain(
    "31 Dec 2027",
  );
  expect(renderToStaticMarkup(<Dates edition={edition} />)).toContain(
    "1 Jan 2028",
  );
  expect(renderToStaticMarkup(<Dates edition={edition} />)).toContain("2 days");
  expect(
    renderToStaticMarkup(
      <Dates
        edition={{ ...edition, startsOn: "2027-07-01", endsOn: "2027-07-03" }}
      />,
    ),
  ).toContain("3 days");
  expect(
    renderToStaticMarkup(
      <Dates edition={{ ...edition, endsOn: edition.startsOn }} />,
    ),
  ).toContain("1 day");
  const place = renderToStaticMarkup(
    <Location
      edition={{
        ...edition,
        venueName: null,
        locality: null,
        administrativeArea: null,
        countryCode: "PT",
      }}
    />,
  );
  expect(place).toContain("Portugal");
  expect(place).toContain(
    'title="Map location unavailable">· Not mapped</span>',
  );
  expect(place).toContain('aria-hidden="true"');
  expect(place).not.toContain("null");
});
test("link groups deduplicate URLs, distinguish repeated hosts, and name historical tickets", () => {
  const links = [
    { kind: "ticketing", url: "https://example.org/a", label: null },
    { kind: "ticketing", url: "https://example.org/b", label: null },
    { kind: "other", url: "https://example.org/a", label: null },
  ];
  const names = namedLinks(links, 2025);
  expect(names).toHaveLength(2);
  expect(new Set(names.map((link) => link.name)).size).toBe(2);
  expect(names[0].name).toContain("2025");
  const output = renderToStaticMarkup(
    <ExternalLinks links={links} historicalYear={2025} />,
  );
  expect(output.match(/class="external-link"/g)).toHaveLength(2);
  expect(output).toContain('title="Tickets (2025)');
  expect(output).toContain('aria-label="Tickets (2025)');
  for (const link of names) {
    expect(output).toContain(`<span>${link.name}</span>`);
  }
});
test("Edition layout preserves section order and shared history while Event stays small", () => {
  const data = event();
  const edition = data.editions[0];
  const output = renderToStaticMarkup(
    <EditionDetailsPage
      event={data}
      edition={edition}
      token="visit"
      now={new Date("2026-10-01")}
    />,
  );
  const headings = [
    "About the festival",
    ">Tickets</h2>",
    ">Location</h2>",
    "Other editions",
  ];
  const positions = headings.map((text) => output.indexOf(text));
  expect(positions.every((pos) => pos >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(output).toContain("Ticket information not available");
  expect(output).not.toContain("location-canvas");
  expect(output).not.toContain("Show on map");
  expect(output).toContain("Current edition");
  expect(output).toContain("discovery=visit");
  expect(output).toContain("2027 · 1 Jan 2027");
  const small = renderToStaticMarkup(
    <EventDetailsPage event={data} token="visit" />,
  );
  expect(small).toContain("A general festival description.");
  expect(small).not.toContain("Current edition");
  expect(small).not.toContain("Tickets");
  expect(small).not.toContain("location-canvas");
  expect(small.indexOf("31 Dec 2027")).toBeLessThan(
    small.indexOf("1 Jan 2027"),
  );
  expect(small).toContain("Cancelled");
  expect(small).toContain("discovery=visit");
  const noSummary = renderToStaticMarkup(
    <EditionDetailsPage
      event={{ ...data, summary: null }}
      edition={{
        ...edition,
        latitude: 38,
        longitude: -9,
        coordinatePrecision: "locality",
      }}
    />,
  );
  expect(noSummary).not.toContain("About the festival");
  expect(noSummary).toContain("Open approximate location");
  expect(noSummary).toContain("www.google.com/maps/search/");
  expect(noSummary).toContain("Show on map");
});

test("date ranges keep the year without repeated month text", () => {
  expect(dateRange("2027-06-10", "2027-06-12")).toBe("10–12 Jun 2027");
  expect(dateRange("2027-06-30", "2027-07-02")).toBe("30 Jun–2 Jul 2027");
  expect(dateRange("2027-12-31", "2028-01-01")).toBe("31 Dec 2027–1 Jan 2028");
  expect(dateRange("2027-06-10", "2027-06-10")).toBe("10 Jun 2027");
});
test("additional official sites use an information icon and retain distinct names", () => {
  const output = renderToStaticMarkup(
    <ExternalLinks
      links={[
        {
          kind: "official_site",
          url: "https://example.org",
          label: "Festival website",
        },
        {
          kind: "official_site",
          url: "https://example.org/info",
          label: "Visitor information",
        },
        { kind: "ticketing", url: "https://tickets.example.org", label: null },
      ]}
    />,
  );
  expect(output).toContain('aria-label="Festival website"');
  expect(output).toContain('aria-label="Visitor information"');
  expect(output).toContain("M12 11v6M12 7h.01");
  expect(output).toContain('aria-label="Tickets"');
});

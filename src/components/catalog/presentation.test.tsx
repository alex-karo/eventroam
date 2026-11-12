import { createRef } from "react";
import { load } from "cheerio";
import { SelectedPreview } from "@/features/discovery/components/selected-preview";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { publicEvent } from "@/catalog/read/public-catalog";
import { Dates, Location } from "./catalog";
import { dateRange } from "./format";
import { ExternalLinks, namedLinks } from "./external-links";
import { EditionDetailsPage } from "@/features/event-details/edition-page";
import { editionMetadata, eventMetadata } from "@/site/server/metadata";
import { editionStructuredData } from "@/site/server/structured-data";
import { EventDetailsPage } from "@/features/event-details/event-page";

function event() {
  const client = testDatabase().client;
  const fixture = testFixtures(client).publishedEvent({
    event: { description: "A general festival description." },
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

test("a confirmed sell-out shows an outlined link and keeps the ticket destination", () => {
  const data = event();
  const ticketUrl = "https://tickets.example.org/festival";
  const siteUrl = "https://festival.example.org/";
  const edition = {
    ...data.editions[0],
    soldOut: true,
    links: [
      { kind: "official_site", url: ticketUrl, label: null },
      { kind: "official_site", url: siteUrl, label: null },
      { kind: "ticketing", url: ticketUrl, label: "Buy tickets" },
    ],
  };
  const $ = load(
    renderToStaticMarkup(
      <EditionDetailsPage
        event={data}
        edition={edition}
        now={new Date("2026-10-01")}
      />,
    ),
  );
  const links = $(".edition-booking .external-links a");
  expect(
    links
      .map((_, link) =>
        [$(link).attr("href"), $(link).attr("aria-label")].join(" "),
      )
      .get(),
  ).toEqual([`${ticketUrl} Sold out`, `${siteUrl} Official site`]);
  expect(links.filter(".external-link-primary")).toHaveLength(0);
});
test("Edition layout preserves section order and shared history while Event stays small", () => {
  const data = event();
  const edition = data.editions[0];
  const output = renderToStaticMarkup(
    <EditionDetailsPage
      event={data}
      edition={edition}
      now={new Date("2026-10-01")}
    />,
  );
  const $ = load(output);
  expect(
    $("main > section > h2")
      .map((_, el) => $(el).text())
      .get(),
  ).toEqual(["About the festival", "Location", "Other editions"]);
  expect($("#tickets")).toHaveLength(0);
  expect($(".edition-booking").text()).toContain(
    "Ticket information not available",
  );
  expect(output.match(/Ticket information not available/g)).toHaveLength(1);
  expect(output).toContain("Ticket information not available");
  expect(output).not.toContain("location-canvas");
  expect(output).not.toContain("Show on map");
  expect(output).toContain("Current edition");
  expect(output).not.toContain("Back to results");
  expect(output).not.toContain("discovery=");
  expect(output).toContain('target="_blank" rel="noopener noreferrer"');
  expect(output).toContain("2027 · 1 Jan 2027");
  const small = renderToStaticMarkup(
    <EventDetailsPage event={data} alternatives={[]} />,
  );
  expect(small).toContain("A general festival description.");
  expect(small).not.toContain("Current edition");
  expect(small).not.toContain("Tickets");
  expect(small).not.toContain("location-canvas");
  expect(small.indexOf("31 Dec 2027")).toBeLessThan(
    small.indexOf("1 Jan 2027"),
  );
  expect(small).toContain("Cancelled");
  expect(small).not.toContain("Back to results");
  expect(small).not.toContain("discovery=");
  expect(small).toContain('target="_blank" rel="noopener noreferrer"');
  const withMap = renderToStaticMarkup(
    <EditionDetailsPage
      event={data}
      edition={{
        ...edition,
        latitude: 38,
        longitude: -9,
        coordinatePrecision: "locality",
      }}
    />,
  );
  expect(withMap).toContain("Open approximate location");
  expect(withMap).toContain("www.google.com/maps/search/");
  expect(withMap).toContain("Show on map");
});

test("Event alternatives show facts from the selected Edition", () => {
  const data = event();
  const edition = testFixtures(testDatabase().client).build.summary({
    eventName: "River Beats",
    eventSlug: "river-beats",
    key: "summer",
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
    dateState: "provisional",
    locality: "Ghent",
    countryCode: "BE",
  });
  const $ = load(
    renderToStaticMarkup(
      <EventDetailsPage
        event={data}
        alternatives={[{ edition, sharedGenreName: "Electronic" }]}
      />,
    ),
  );
  const section = $("section[aria-labelledby='similar-festivals-heading']");
  expect(section.find("h2").text()).toBe(`Festivals like ${data.name}`);
  const card = section.find("li");
  expect(card).toHaveLength(1);
  expect(card.find("a").text()).toBe("River Beats");
  expect(card.text()).toContain("10–12 Jun 2027");
  expect(card.text()).toContain("3 days");
  expect(card.text()).toContain("Ghent, Belgium");
  expect(card.text()).toContain("Shared genre · Electronic");
  expect(card.text()).toContain("Tentative dates");
});

test("Edition opening separates festival summary, price and booking links from details", () => {
  const data = { ...event(), shortDescription: "A short festival summary." };
  const edition = {
    ...data.editions[0],
    terms: [
      { facet: "format", name: "Open-air" },
      { facet: "genre", name: "Electronic" },
    ],
    priceKind: "from",
    priceCurrency: "EUR",
    priceMinMinor: 6990,
    priceCoverage: "day_pass",
    priceQualification: "Plus fees. Check the ticket site.",
    ticketCategories: [{ label: "Regular", availability: "sold_out" as const }],
    venueAddress: "Test street 12",
    links: [
      { kind: "official_site", url: "https://example.org/", label: null },
      { kind: "ticketing", url: "https://example.org/tickets", label: null },
      {
        kind: "ticketing",
        url: "https://example.org/other-tickets",
        label: null,
      },
      { kind: "instagram", url: "https://example.org/social", label: null },
    ],
  };
  const $ = load(
    renderToStaticMarkup(
      <EditionDetailsPage
        event={data}
        edition={edition}
        now={new Date("2026-10-01")}
      />,
    ),
  );
  expect(
    $(".edition-opening h1 + .fact-tags > li")
      .map((_, el) => $(el).text())
      .get(),
  ).toEqual(["Electronic", "Open-air"]);
  expect($(".edition-summary").text()).toBe(data.shortDescription);
  expect($("main > section").first().text()).toContain(data.description);
  const booking = $(".edition-booking");
  expect(booking.text()).toContain("From €69.90 (day pass)");
  expect(booking.text()).toContain(edition.priceQualification);
  expect(booking.text()).not.toContain("Sold out");
  expect(booking.find(".external-link-primary")).toHaveLength(1);
  expect(booking.find(".external-link-primary").attr("href")).toBe(
    edition.links[1].url,
  );
  expect(booking.find(".external-links a").first().attr("href")).toBe(
    edition.links[1].url,
  );
  expect(
    booking
      .find(".external-links a")
      .map((_, el) => $(el).attr("href"))
      .get()
      .toSorted(),
  ).toEqual(
    edition.links
      .slice(0, 3)
      .map(({ url }) => url)
      .toSorted(),
  );
  expect(
    $("main > section").last().find('a[href="https://example.org/social"]'),
  ).toHaveLength(1);
  expect($(".edition-opening").text()).not.toContain(edition.venueAddress);
  expect($("#location").text()).toContain(edition.venueAddress);
  expect($("#tickets").text()).toContain("Sold out");
  expect(
    $("main > section > h2")
      .map((_, el) => $(el).text())
      .get(),
  ).toEqual([
    "About the festival",
    "Ticket categories",
    "Location",
    "Other editions",
    "More links",
  ]);
});

test.each(["past", "cancelled", "postponed", "no-tickets"] as const)(
  "A confirmed sell-out still uses the official site as primary for %s",
  (state) => {
    const data = { ...event(), shortDescription: "  " };
    const edition = {
      ...data.editions[0],
      soldOut: true,
      status:
        state === "cancelled" || state === "postponed"
          ? state
          : ("scheduled" as const),
      links: [
        { kind: "official_site", url: "https://example.org/", label: null },
        ...(state === "no-tickets"
          ? []
          : [
              {
                kind: "ticketing",
                url: "https://example.org/tickets",
                label: null,
              },
            ]),
      ],
    };
    const $ = load(
      renderToStaticMarkup(
        <EditionDetailsPage
          event={data}
          edition={edition}
          now={new Date(state === "past" ? "2029-01-01" : "2026-10-01")}
        />,
      ),
    );
    expect($(".edition-booking .external-link-primary").attr("href")).toBe(
      edition.links[0].url,
    );
    expect($(".edition-booking").text()).not.toContain("Sold out");
    expect($(".edition-summary")).toHaveLength(0);
    if (state === "past") {
      expect($(".edition-facts").text()).toContain("Past edition");
      expect($(".edition-booking h2").text()).toBe("Prices for this edition");
      expect(
        $("a[href='https://example.org/tickets']").attr("aria-label"),
      ).toContain(String(edition.year));
    }
    if (state === "postponed") {
      expect($(".edition-facts").text()).toContain(
        "Postponed — new dates TBA. Previous dates:",
      );
    }
    if (state === "cancelled") {
      expect($(".edition-facts .edition-state").text()).toBe("Cancelled");
    }
  },
);

test("Edition category amounts do not become a missing base price", () => {
  const data = event();
  const edition = {
    ...data.editions[0],
    ticketCategories: [{ label: "Regular", amount: 100, currency: "EUR" }],
  };
  const $ = load(
    renderToStaticMarkup(<EditionDetailsPage event={data} edition={edition} />),
  );
  expect($(".edition-booking").text()).toContain("Price not available");
  expect($(".edition-booking").text()).not.toContain("€100.00");
  expect($("#tickets").text()).toContain("€100.00");
  expect($(".external-link-primary")).toHaveLength(0);
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

test("selected preview shows all facts and opens both page links in a new tab", () => {
  const edition = {
    ...event().editions[0],
    terms: [{ facet: "genre", name: "Electronic" }],
    sizeEstimate: 5000,
    priceKind: "free",
    links: [{ kind: "website", url: "https://festival.example/", label: null }],
  };
  const $ = load(
    renderToStaticMarkup(
      <SelectedPreview
        detailState={{ status: "ready", id: edition.id, data: edition }}
        panelRef={createRef<HTMLElement>()}
        onClose={() => undefined}
        onRetry={() => undefined}
        now={new Date("2026-10-01")}
      />,
    ),
  );
  const card = $(".detail-panel");
  expect(card.text()).toContain("Electronic");
  expect(card.text()).toContain("Estimated size: 5,000 people");
  expect(card.text()).toContain("Tickets: Free");
  expect(card.find('a[href="https://festival.example/"]')).toHaveLength(1);
  expect(
    card.find('button[aria-label="Expand details"]').attr("aria-expanded"),
  ).toBe("false");
  expect(card.find('button[aria-label="Close details"]')).toHaveLength(1);
  const pageLinks = card.find("h2 a, .view-edition");
  expect(pageLinks).toHaveLength(2);
  pageLinks.each((_, link) => {
    expect($(link).attr("target")).toBe("_blank");
    expect($(link).attr("rel")).toBe("noopener noreferrer");
    expect($(link).attr("href")).not.toContain("discovery=");
  });
});

test.each([
  ["Detailed text.", "Short text.", "Detailed text.", "Short text."],
  ["Detailed text.", "  ", "Detailed text.", "Detailed text."],
  ["\t", "Short text.", "Short text.", "Short text."],
  ["", null, null, null],
] as const)(
  "festival text on pages and previews (%s, %s)",
  (description, shortDescription, body, preview) => {
    const data = { ...event(), description, shortDescription };
    const edition = data.editions.find(({ year }) => year === 2025)!;
    const origin = "https://festivals.eventroam.org";
    const now = new Date("2026-10-01");
    const automatic = `${data.name} is a festival listed in the Eventroam catalog.`;
    const eventPage = load(
      renderToStaticMarkup(<EventDetailsPage event={data} alternatives={[]} />),
    );
    const editionPage = load(
      renderToStaticMarkup(
        <EditionDetailsPage event={data} edition={edition} now={now} />,
      ),
    );
    expect(eventPage("main > p").text()).toBe(body ?? automatic);
    const about = editionPage("h2").filter(
      (_, heading) => editionPage(heading).text() === "About the festival",
    );
    expect(about.next("p").text()).toBe(body ?? automatic);
    expect(editionStructuredData(data, edition, origin)?.description).toBe(
      body ?? automatic,
    );
    const metadata = eventMetadata(data, origin);
    const eventPreview = preview ? `${data.name}. ${preview}` : automatic;
    expect(metadata.description).toBe(eventPreview);
    expect(metadata.openGraph?.description).toBe(eventPreview);
    expect(metadata.twitter?.description).toBe(eventPreview);

    const editionPreview = `${edition.name ?? data.name}, 2025. Cancelled · Past edition. Dates: 1 Jan 2025. ${preview ?? "Test Valley, Portugal."}`;
    const dated = editionMetadata(data, edition, origin, now);
    expect(dated.description).toBe(editionPreview);
    expect(dated.openGraph?.description).toBe(editionPreview);
    expect(dated.twitter?.description).toBe(editionPreview);
  },
);

test("Event metadata does not repeat the name at the start of the preview", () => {
  const data = event();
  const shortDescription = `${data.name} is an outdoor music festival.`;
  const metadata = eventMetadata(
    { ...data, shortDescription },
    "https://festivals.eventroam.org",
  );
  expect(metadata.description).toBe(shortDescription);
});

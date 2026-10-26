import { validateCatalogValues } from "@/catalog/write/validate-values";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
  urlAliases,
} from "@/db/schema";

// Fictional events use city-center markers; their dates and links are placeholders.
const geographicExamples = [
  {
    slug: "fictional-atlantic-sounds",
    name: "Fictional Atlantic Sounds",
    countryCode: "PT",
    locality: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
  },
  {
    slug: "fictional-mediterranean-nights",
    name: "Fictional Mediterranean Nights",
    countryCode: "ES",
    locality: "Barcelona",
    latitude: 41.3874,
    longitude: 2.1686,
    startsOn: "2027-07-15",
    endsOn: "2027-07-17",
  },
  {
    slug: "fictional-rhone-sessions",
    name: "Fictional Rhône Sessions",
    countryCode: "FR",
    locality: "Lyon",
    latitude: 45.764,
    longitude: 4.8357,
    startsOn: "2027-08-19",
    endsOn: "2027-08-21",
  },
] as const;
export function seedDevelopmentFixtures(client: Database.Database) {
  const now = "2026-10-01T12:00:00.000Z";
  return drizzle(client).transaction((db) => {
    function termId(
      facet: typeof taxonomyTerms.$inferSelect.facet,
      slug: string,
    ) {
      const term = db
        .select({ id: taxonomyTerms.id })
        .from(taxonomyTerms)
        .where(
          and(eq(taxonomyTerms.facet, facet), eq(taxonomyTerms.slug, slug)),
        )
        .get();
      if (!term) {
        throw new Error(`Missing development fixture term: ${facet}/${slug}`);
      }
      return term.id;
    }
    const termIds = [
      termId("event_type", "festival"),
      termId("format", "openair"),
      termId("topic", "music"),
    ];
    const rockId = termId("genre", "rock");
    const electronicId = termId("genre", "electronic");

    function addEvent(slug: string, canonicalName: string) {
      const existing = db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .get();
      if (existing) {
        return { id: existing.id, created: false };
      }
      const id = randomUUID();
      db.insert(events)
        .values(
          validateCatalogValues(client, "events", {
            id,
            slug,
            canonicalName,
            summary:
              "A fictional open-air festival used for local development. Each year has its own dates and ticket details.",
            homeScope: "festivals",
            publicationState: "published",
            createdAt: now,
            updatedAt: now,
          }),
        )
        .run();
      db.insert(urlAliases)
        .values(
          validateCatalogValues(client, "url_aliases", {
            scope: "festivals",
            path: `/events/${slug}`,
            eventId: id,
            createdAt: now,
          }),
        )
        .run();
      return { id, created: true };
    }

    function addEdition(
      eventId: string,
      data: Omit<
        typeof editions.$inferInsert,
        "id" | "eventId" | "createdAt" | "updatedAt"
      >,
      genreIds = [rockId],
    ) {
      const id = randomUUID();
      db.insert(editions)
        .values(
          validateCatalogValues(client, "editions", {
            id,
            eventId,
            ...data,
            createdAt: now,
            updatedAt: now,
          }),
        )
        .run();
      const parent = db
        .select({ slug: events.slug })
        .from(events)
        .where(eq(events.id, eventId))
        .get()!;
      db.insert(urlAliases)
        .values(
          validateCatalogValues(client, "url_aliases", {
            scope: "festivals",
            path: `/events/${parent.slug}/${data.editionKey}`,
            eventId,
            editionId: id,
            createdAt: now,
          }),
        )
        .run();
      for (const termId of [...termIds, ...genreIds]) {
        db.insert(editionTerms)
          .values(
            validateCatalogValues(client, "edition_terms", {
              editionId: id,
              termId,
            }),
          )
          .run();
      }
    }

    const event = addEvent("fictional-field-days", "Fictional Field Days");
    if (event.created) {
      for (const [key, year, start, end, status] of [
        ["2025", 2025, "2025-07-01", "2025-07-03", "scheduled"],
        ["2027", 2027, "2027-07-01", "2027-07-03", "scheduled"],
        ["2026-cancelled", 2026, "2026-07-01", "2026-07-03", "cancelled"],
      ] as const) {
        addEdition(event.id, {
          editionKey: key,
          editionYear: year,
          startsOn: start,
          endsOn: end,
          dateState: year === 2027 ? "provisional" : "confirmed",
          scheduleStatus: status,
          countryCode: "PT",
          locality: "Example Valley",
          priceKind: "from",
          priceCurrency: "EUR",
          priceMinMinor: 6990,
          priceMaxMinor: 6990,
          priceCoverage: "full_programme",
          priceQualification:
            "Promotion price, plus fees. This does not confirm availability.",
          priceDetails: [
            {
              label: "Early Bird",
              amount: 69.9,
              currency: "EUR",
              availability: "sold_out",
              terms:
                "Full festival pass. Handling fees are added by the ticket seller. This promotional category has sold out.",
            },
            {
              label: "Regular",
              amount: 99.9,
              currency: "EUR",
              availability: "available",
              terms:
                "Full festival pass. Check the official ticket site for current conditions and fees.",
            },
            { label: "Children", amount: 0, terms: "Registration required." },
            { label: "Day pass", availability: "closed" },
          ],
          publicationState: "published",
        });
      }
    }

    if (event.created) {
      for (const [kind, path, label] of [
        ["official_site", "festival", "Festival website"],
        ["official_site", "info", "Visitor information"],
        ["ticketing", "tickets", "Tickets"],
      ] as const) {
        db.insert(externalLinks)
          .values(
            validateCatalogValues(client, "external_links", {
              id: randomUUID(),
              eventId: event.id,
              kind,
              url: `https://example.org/fictional-field-days/${path}`,
              label,
              official: true,
              createdAt: now,
              updatedAt: now,
            }),
          )
          .run();
      }
    }
    for (const example of geographicExamples) {
      const added = addEvent(example.slug, example.name);
      if (!added.created) {
        continue;
      }
      addEdition(
        added.id,
        {
          editionKey: "2027",
          editionYear: 2027,
          startsOn: example.startsOn,
          endsOn: example.endsOn,
          dateState: "provisional",
          scheduleStatus: "scheduled",
          countryCode: example.countryCode,
          locality: example.locality,
          latitude: example.latitude,
          longitude: example.longitude,
          coordinatePrecision: "locality",
          publicationState: "published",
        },
        example.countryCode === "PT" ? [electronicId] : [rockId],
      );
      db.insert(externalLinks)
        .values(
          validateCatalogValues(client, "external_links", {
            id: randomUUID(),
            eventId: added.id,
            kind: "official_site",
            url: `https://example.org/${example.slug}`,
            label: "Fictional festival website",
            official: true,
            createdAt: now,
            updatedAt: now,
          }),
        )
        .run();
    }
    return event.id;
  });
}

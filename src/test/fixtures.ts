import { validateCatalogValues } from "@/catalog/write/validate-values";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
  urlAliases,
} from "@/db/schema";
import { testDatabase } from "@/test/database";

const timestamp = "2026-10-01T12:00:00Z";

type EventRow = typeof events.$inferSelect;
type EditionRow = typeof editions.$inferSelect;
type TermRow = typeof taxonomyTerms.$inferSelect;
type EventInput = Partial<typeof events.$inferInsert>;
type EditionInput = Partial<Omit<typeof editions.$inferInsert, "eventId">>;
type PublishedEditionInput = Omit<EditionInput, "publicationState">;
type TermInput = Partial<typeof taxonomyTerms.$inferInsert>;
type LinkInput = Partial<
  Omit<typeof externalLinks.$inferInsert, "eventId" | "editionId">
>;
type AliasInput = Partial<
  Omit<typeof urlAliases.$inferInsert, "eventId" | "editionId">
>;
type LinkOwner =
  | { event: EventRow; edition?: never }
  | {
      event?: never;
      edition: EditionRow;
    };

function supplied<T extends object>(overrides: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Builders do not access SQLite; the database opens only for insert methods. */
export function testFixtures(client?: Database.Database) {
  let eventNumber = 0;
  let termNumber = 0;
  let linkNumber = 0;
  const usedSlugs = new Set<string>();
  const usedKeys = new Map<string, Set<string>>();
  const usedTermSlugs = new Set<string>();
  const usedLinkUrls = new Set<string>();
  const connectionClient = () => client ?? testDatabase().client;
  const db = () => drizzle(connectionClient());

  function uniqueSlug() {
    let slug: string;
    do {
      eventNumber += 1;
      slug =
        eventNumber === 1
          ? "test-field-days"
          : `test-field-days-${eventNumber}`;
    } while (usedSlugs.has(slug));
    usedSlugs.add(slug);
    return slug;
  }

  function uniqueKey(eventId: string, year: number | null) {
    const used = usedKeys.get(eventId) ?? new Set<string>();
    usedKeys.set(eventId, used);
    const base = String(year ?? 2027);
    let key = base;
    let suffix = 2;
    while (used.has(key)) {
      key = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(key);
    return key;
  }

  function uniqueUrl() {
    const used = usedLinkUrls;
    let url: string;
    do {
      linkNumber += 1;
      url = `https://example.org/test-link-${linkNumber}`;
    } while (used.has(url));
    used.add(url);
    return url;
  }

  const build = {
    event(overrides: EventInput = {}): typeof events.$inferInsert {
      const slug = overrides.slug === undefined ? uniqueSlug() : overrides.slug;
      usedSlugs.add(slug);
      return {
        id: randomUUID(),
        slug,
        canonicalName: "Test Field Days",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...supplied(overrides),
      };
    },

    edition(
      event: Pick<EventRow, "id">,
      overrides: EditionInput = {},
    ): typeof editions.$inferInsert {
      const startsOn =
        overrides.startsOn === undefined ? "2027-07-01" : overrides.startsOn;
      let year = overrides.editionYear;
      if (year === undefined) {
        year = startsOn ? Number(startsOn.slice(0, 4)) : null;
      }
      const key =
        overrides.editionKey === undefined
          ? uniqueKey(event.id, year)
          : overrides.editionKey;
      if (overrides.editionKey !== undefined) {
        const used = usedKeys.get(event.id) ?? new Set<string>();
        used.add(key);
        usedKeys.set(event.id, used);
      }
      return {
        id: randomUUID(),
        eventId: event.id,
        editionKey: key,
        editionYear: year,
        startsOn,
        endsOn: overrides.endsOn === undefined ? startsOn : overrides.endsOn,
        dateState: startsOn ? "confirmed" : "unknown",
        scheduleStatus: startsOn ? "scheduled" : "announced",
        countryCode: "PT",
        locality: "Test Valley",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...supplied(overrides),
      };
    },

    term(overrides: TermInput = {}): typeof taxonomyTerms.$inferInsert {
      const facet = overrides.facet === undefined ? "genre" : overrides.facet;
      termNumber += 1;
      let slug =
        overrides.slug === undefined
          ? `test-genre-${termNumber}`
          : overrides.slug;
      if (overrides.slug === undefined) {
        while (usedTermSlugs.has(`${facet}:${slug}`)) {
          termNumber += 1;
          slug = `test-genre-${termNumber}`;
        }
      }
      usedTermSlugs.add(`${facet}:${slug}`);
      return {
        id: randomUUID(),
        facet,
        slug,
        name: `Test Genre ${termNumber}`,
        ...supplied(overrides),
      };
    },

    link(
      owner: LinkOwner,
      overrides: LinkInput = {},
    ): typeof externalLinks.$inferInsert {
      const url = overrides.url === undefined ? uniqueUrl() : overrides.url;
      usedLinkUrls.add(url);
      return {
        id: randomUUID(),
        eventId: owner.event?.id,
        editionId: owner.edition?.id,
        kind: "official_site",
        url,
        official: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...supplied(overrides),
      };
    },

    alias(
      event: EventRow,
      overrides: AliasInput & { edition?: EditionRow } = {},
    ): typeof urlAliases.$inferInsert {
      const { edition, ...values } = overrides;
      const editionSuffix = edition ? `/${edition.editionKey}` : "";
      return {
        scope: "festivals",
        path: `/events/${event.slug}${editionSuffix}`,
        eventId: event.id,
        editionId: edition?.id,
        createdAt: timestamp,
        ...supplied(values),
      };
    },

    editionTerm(
      edition: Pick<EditionRow, "id">,
      classification: Pick<TermRow, "id">,
    ): typeof editionTerms.$inferInsert {
      return { editionId: edition.id, termId: classification.id };
    },

    summary(overrides: Partial<DiscoverySummary> = {}): DiscoverySummary {
      return {
        id: "test-edition",
        eventSlug: "test-event",
        eventName: "Test Event",
        aliases: [],
        name: null,
        year: 2027,
        key: "2027",
        startsOn: "2027-07-01",
        endsOn: "2027-07-01",
        dateState: "confirmed",
        status: "scheduled",
        countryCode: "PT",
        locality: "Test Valley",
        administrativeArea: null,
        venueName: null,
        latitude: null,
        longitude: null,
        coordinatePrecision: "unknown",
        timeZone: null,
        capacityEstimate: null,
        genres: [],
        ...supplied(overrides),
      };
    },
  };

  function event(overrides: EventInput = {}) {
    return db().transaction(() =>
      db()
        .insert(events)
        .values(
          validateCatalogValues(
            connectionClient(),
            "events",
            build.event(overrides),
          ),
        )
        .returning()
        .get(),
    );
  }

  function edition(parent: Pick<EventRow, "id">, overrides: EditionInput = {}) {
    return db().transaction(() =>
      db()
        .insert(editions)
        .values(
          validateCatalogValues(
            connectionClient(),
            "editions",
            build.edition(parent, overrides),
          ),
        )
        .returning()
        .get(),
    );
  }

  function term(overrides: TermInput = {}) {
    return db().transaction(() =>
      db()
        .insert(taxonomyTerms)
        .values(
          validateCatalogValues(
            connectionClient(),
            "taxonomy_terms",
            build.term(overrides),
          ),
        )
        .returning()
        .get(),
    );
  }

  function assignTerm(
    edition: Pick<EditionRow, "id">,
    classification: Pick<TermRow, "id">,
  ) {
    return db().transaction(() =>
      db()
        .insert(editionTerms)
        .values(
          validateCatalogValues(
            connectionClient(),
            "edition_terms",
            build.editionTerm(edition, classification),
          ),
        )
        .returning()
        .get(),
    );
  }

  function link(owner: LinkOwner, overrides: LinkInput = {}) {
    return db().transaction(() =>
      db()
        .insert(externalLinks)
        .values(
          validateCatalogValues(
            connectionClient(),
            "external_links",
            build.link(owner, overrides),
          ),
        )
        .returning()
        .get(),
    );
  }

  function alias(
    parent: EventRow,
    overrides: AliasInput & { edition?: EditionRow } = {},
  ) {
    return db().transaction(() =>
      db()
        .insert(urlAliases)
        .values(
          validateCatalogValues(
            connectionClient(),
            "url_aliases",
            build.alias(parent, overrides),
          ),
        )
        .returning()
        .get(),
    );
  }

  function festivalTerms() {
    const values = [
      {
        id: "test-festival",
        facet: "event_type",
        slug: "festival",
        name: "Festival",
      },
      {
        id: "test-openair",
        facet: "format",
        slug: "openair",
        name: "Open-air",
      },
      { id: "test-music", facet: "topic", slug: "music", name: "Music" },
    ] as const;
    return db().transaction((connection) => {
      for (const value of values) {
        connection
          .insert(taxonomyTerms)
          .values(
            validateCatalogValues(connectionClient(), "taxonomy_terms", value),
          )
          .onConflictDoNothing()
          .run();
      }
      return values.map((value) => {
        const found = connection
          .select()
          .from(taxonomyTerms)
          .where(
            and(
              eq(taxonomyTerms.facet, value.facet),
              eq(taxonomyTerms.slug, value.slug),
            ),
          )
          .get();
        if (!found) {
          throw new Error(`Missing test term: ${value.facet}/${value.slug}`);
        }
        return found;
      });
    });
  }

  function publishedEdition(
    parent: Pick<EventRow, "id">,
    overrides: PublishedEditionInput = {},
  ) {
    return db().transaction(() => {
      const published = edition(parent, {
        ...overrides,
        publicationState: "published",
      });
      for (const classification of festivalTerms()) {
        assignTerm(published, classification);
      }
      const publishedParent = db()
        .select()
        .from(events)
        .where(eq(events.id, parent.id))
        .get();
      if (publishedParent?.homeScope) {
        alias(publishedParent, {
          edition: published,
          scope: publishedParent.homeScope,
        });
      }
      return published;
    });
  }

  function publishEvent(parent: Pick<EventRow, "id">) {
    return db().transaction(() => {
      const connection = db();
      const published = connection
        .update(events)
        .set({ publicationState: "published", homeScope: "festivals" })
        .where(eq(events.id, parent.id))
        .returning()
        .get();
      if (!published) {
        throw new Error(`Missing test event: ${parent.id}`);
      }
      validateCatalogValues(connectionClient(), "events", published);
      connection
        .insert(urlAliases)
        .values(
          validateCatalogValues(
            connectionClient(),
            "url_aliases",
            build.alias(published),
          ),
        )
        .onConflictDoNothing()
        .run();
      for (const edition of connection
        .select()
        .from(editions)
        .where(eq(editions.eventId, parent.id))
        .all()) {
        if (edition.publicationState !== "published") {
          continue;
        }
        connection
          .insert(urlAliases)
          .values(
            validateCatalogValues(
              connectionClient(),
              "url_aliases",
              build.alias(published, { edition: edition }),
            ),
          )
          .onConflictDoNothing()
          .run();
      }
      return published;
    });
  }

  function publishedEvent(
    data: {
      event?: Omit<EventInput, "publicationState" | "homeScope">;
      editions?: PublishedEditionInput[];
    } = {},
  ) {
    return db().transaction(() => {
      const parent = event(data.event);
      const editions = (data.editions ?? [{}]).map((input) =>
        publishedEdition(parent, input),
      );
      return { event: publishEvent(parent), editions: editions };
    });
  }

  return {
    build,
    event,
    edition,
    term,
    assignTerm,
    link,
    eventLink: (parent: EventRow, overrides: LinkInput = {}) =>
      link({ event: parent }, overrides),
    editionLink: (edition: EditionRow, overrides: LinkInput = {}) =>
      link({ edition: edition }, overrides),
    alias,
    festivalTerms,
    publishedEdition,
    publishEvent,
    publishedEvent,
  };
}

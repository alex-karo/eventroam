import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DiscoverySummary } from "../application/discovery";
import {
  events,
  externalLinks,
  occurrenceTerms,
  occurrences,
  sourceSubjects,
  sources,
  taxonomyTerms,
  urlAliases,
} from "../db/schema";
import { testDatabase } from "./database";

const timestamp = "2026-10-01T12:00:00Z";

type EventRow = typeof events.$inferSelect;
type OccurrenceRow = typeof occurrences.$inferSelect;
type TermRow = typeof taxonomyTerms.$inferSelect;
type SourceRow = typeof sources.$inferSelect;
type EventInput = Partial<typeof events.$inferInsert>;
type OccurrenceInput = Partial<
  Omit<typeof occurrences.$inferInsert, "eventId">
>;
type PublishedOccurrenceInput = Omit<OccurrenceInput, "publicationState">;
type TermInput = Partial<typeof taxonomyTerms.$inferInsert>;
type SourceInput = Partial<typeof sources.$inferInsert>;
type LinkInput = Partial<
  Omit<typeof externalLinks.$inferInsert, "eventId" | "occurrenceId">
>;
type AliasInput = Partial<
  Omit<typeof urlAliases.$inferInsert, "eventId" | "occurrenceId">
>;
type LinkOwner =
  | { event: EventRow; occurrence?: never }
  | {
      event?: never;
      occurrence: OccurrenceRow;
    };
type Subject = LinkOwner;

function supplied<T extends object>(overrides: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Builders do not access SQLite; the database opens only for insert methods. */
export function testFixtures(client?: Database.Database) {
  let eventNumber = 0;
  let termNumber = 0;
  let sourceNumber = 0;
  let linkNumber = 0;
  const usedSlugs = new Set<string>();
  const usedKeys = new Map<string, Set<string>>();
  const usedTermSlugs = new Set<string>();
  const usedSourceUrls = new Set<string>();
  const usedLinkUrls = new Set<string>();
  const db = () => drizzle(client ?? testDatabase().client);

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
    for (let suffix = 2; used.has(key); suffix += 1) key = `${base}-${suffix}`;
    used.add(key);
    return key;
  }

  function uniqueUrl(kind: "source" | "link") {
    const used = kind === "source" ? usedSourceUrls : usedLinkUrls;
    let url: string;
    do {
      const number = kind === "source" ? ++sourceNumber : ++linkNumber;
      url = `https://example.org/test-${kind}-${number}`;
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

    occurrence(
      event: Pick<EventRow, "id">,
      overrides: OccurrenceInput = {},
    ): typeof occurrences.$inferInsert {
      const startsOn =
        overrides.startsOn === undefined ? "2027-07-01" : overrides.startsOn;
      const year =
        overrides.occurrenceYear === undefined
          ? startsOn
            ? Number(startsOn.slice(0, 4))
            : null
          : overrides.occurrenceYear;
      const key =
        overrides.occurrenceKey === undefined
          ? uniqueKey(event.id, year)
          : overrides.occurrenceKey;
      if (overrides.occurrenceKey !== undefined) {
        const used = usedKeys.get(event.id) ?? new Set<string>();
        used.add(key);
        usedKeys.set(event.id, used);
      }
      return {
        id: randomUUID(),
        eventId: event.id,
        occurrenceKey: key,
        occurrenceYear: year,
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
      if (overrides.slug === undefined)
        while (usedTermSlugs.has(`${facet}:${slug}`)) {
          termNumber += 1;
          slug = `test-genre-${termNumber}`;
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

    source(overrides: SourceInput = {}): typeof sources.$inferInsert {
      const canonicalUrl =
        overrides.canonicalUrl === undefined
          ? uniqueUrl("source")
          : overrides.canonicalUrl;
      usedSourceUrls.add(canonicalUrl);
      return {
        id: randomUUID(),
        canonicalUrl,
        kind: "website",
        authority: "official",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...supplied(overrides),
      };
    },

    link(
      owner: LinkOwner,
      overrides: LinkInput = {},
    ): typeof externalLinks.$inferInsert {
      const url =
        overrides.url === undefined ? uniqueUrl("link") : overrides.url;
      usedLinkUrls.add(url);
      return {
        id: randomUUID(),
        eventId: owner.event?.id,
        occurrenceId: owner.occurrence?.id,
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
      overrides: AliasInput & { occurrence?: OccurrenceRow } = {},
    ): typeof urlAliases.$inferInsert {
      const { occurrence, ...values } = overrides;
      return {
        scope: "festivals",
        path: `/events/${event.slug}${occurrence ? `/${occurrence.occurrenceKey}` : ""}`,
        eventId: event.id,
        occurrenceId: occurrence?.id,
        createdAt: timestamp,
        ...supplied(values),
      };
    },

    occurrenceTerm(
      edition: Pick<OccurrenceRow, "id">,
      classification: Pick<TermRow, "id">,
    ): typeof occurrenceTerms.$inferInsert {
      return { occurrenceId: edition.id, termId: classification.id };
    },

    sourceSubject(
      origin: Pick<SourceRow, "id">,
      subject: Subject,
    ): typeof sourceSubjects.$inferInsert {
      return {
        sourceId: origin.id,
        eventId: subject.event?.id,
        occurrenceId: subject.occurrence?.id,
      };
    },

    summary(overrides: Partial<DiscoverySummary> = {}): DiscoverySummary {
      return {
        id: "test-occurrence",
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
        ticketAvailability: "unknown",
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
    return db().insert(events).values(build.event(overrides)).returning().get();
  }

  function occurrence(
    parent: Pick<EventRow, "id">,
    overrides: OccurrenceInput = {},
  ) {
    return db()
      .insert(occurrences)
      .values(build.occurrence(parent, overrides))
      .returning()
      .get();
  }

  function term(overrides: TermInput = {}) {
    return db()
      .insert(taxonomyTerms)
      .values(build.term(overrides))
      .returning()
      .get();
  }

  function assignTerm(
    edition: Pick<OccurrenceRow, "id">,
    classification: Pick<TermRow, "id">,
  ) {
    return db()
      .insert(occurrenceTerms)
      .values(build.occurrenceTerm(edition, classification))
      .returning()
      .get();
  }

  function source(overrides: SourceInput = {}) {
    return db()
      .insert(sources)
      .values(build.source(overrides))
      .returning()
      .get();
  }

  function sourceSubject(origin: Pick<SourceRow, "id">, subject: Subject) {
    return db()
      .insert(sourceSubjects)
      .values(build.sourceSubject(origin, subject))
      .returning()
      .get();
  }

  function link(owner: LinkOwner, overrides: LinkInput = {}) {
    return db()
      .insert(externalLinks)
      .values(build.link(owner, overrides))
      .returning()
      .get();
  }

  function alias(
    parent: EventRow,
    overrides: AliasInput & { occurrence?: OccurrenceRow } = {},
  ) {
    return db()
      .insert(urlAliases)
      .values(build.alias(parent, overrides))
      .returning()
      .get();
  }

  function festivalTerms() {
    const values = [
      {
        id: "test-festival",
        facet: "event_type",
        slug: "festival",
        name: "Festival",
      },
      { id: "test-outdoor", facet: "format", slug: "outdoor", name: "Outdoor" },
      { id: "test-music", facet: "topic", slug: "music", name: "Music" },
    ] as const;
    const connection = db();
    for (const value of values)
      connection
        .insert(taxonomyTerms)
        .values(value)
        .onConflictDoNothing()
        .run();
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
      if (!found)
        throw new Error(`Missing test term: ${value.facet}/${value.slug}`);
      return found;
    });
  }

  function publishedOccurrence(
    parent: Pick<EventRow, "id">,
    overrides: PublishedOccurrenceInput = {},
  ) {
    return db().transaction(() => {
      const edition = occurrence(parent, {
        ...overrides,
        publicationState: "published",
      });
      for (const classification of festivalTerms())
        assignTerm(edition, classification);
      const publishedParent = db()
        .select()
        .from(events)
        .where(eq(events.id, parent.id))
        .get();
      if (publishedParent?.homeScope)
        alias(publishedParent, {
          occurrence: edition,
          scope: publishedParent.homeScope,
        });
      return edition;
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
      if (!published) throw new Error(`Missing test event: ${parent.id}`);
      connection
        .insert(urlAliases)
        .values(build.alias(published))
        .onConflictDoNothing()
        .run();
      for (const edition of connection
        .select()
        .from(occurrences)
        .where(eq(occurrences.eventId, parent.id))
        .all()) {
        if (edition.publicationState !== "published") continue;
        connection
          .insert(urlAliases)
          .values(build.alias(published, { occurrence: edition }))
          .onConflictDoNothing()
          .run();
      }
      return published;
    });
  }

  function publishedEvent(
    data: {
      event?: Omit<EventInput, "publicationState" | "homeScope">;
      occurrences?: PublishedOccurrenceInput[];
    } = {},
  ) {
    return db().transaction(() => {
      const parent = event(data.event);
      const editions = (data.occurrences ?? [{}]).map((input) =>
        publishedOccurrence(parent, input),
      );
      return { event: publishEvent(parent), occurrences: editions };
    });
  }

  return {
    build,
    event,
    occurrence,
    term,
    assignTerm,
    source,
    sourceSubject,
    link,
    eventLink: (parent: EventRow, overrides: LinkInput = {}) =>
      link({ event: parent }, overrides),
    occurrenceLink: (edition: OccurrenceRow, overrides: LinkInput = {}) =>
      link({ occurrence: edition }, overrides),
    alias,
    festivalTerms,
    publishedOccurrence,
    publishEvent,
    publishedEvent,
  };
}

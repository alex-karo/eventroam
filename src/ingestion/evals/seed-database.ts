import { validateCatalogValues } from "@/catalog/write/validate-values";
import { openDatabase } from "@/db/connection";
import { migrateCatalogConnection } from "@/db/migrate";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
} from "@/db/schema";
import type { EvalSuite, PipelineEvalCase } from "./fixtures";

type SeedConnection = ReturnType<typeof openDatabase>;
type SeedEvent = PipelineEvalCase["initial"]["event"];
type SeedEdition = SeedEvent["editions"][number];
type SeedLink = NonNullable<SeedEvent["links"]>[number];

const timestamp = "2026-10-03T00:00:00.000Z";

function ticketColumns(tickets: SeedEdition["tickets"]) {
  const base = tickets?.basePrice;
  return {
    priceDetails: tickets?.priceDetails,
    priceKind: base?.kind,
    priceCurrency: base && "currency" in base ? base.currency : null,
    priceMinMinor: base?.minMinor,
    priceMaxMinor: base?.maxMinor,
    priceCoverage: base?.coverage,
    priceQualification: base?.qualification,
  };
}

function insertLinks(
  { client, db }: SeedConnection,
  owner: { eventId: string } | { editionId: string },
  links: SeedLink[] = [],
) {
  const ownerId = "eventId" in owner ? owner.eventId : owner.editionId;
  for (const link of links) {
    db.insert(externalLinks)
      .values(
        validateCatalogValues(client, "external_links", {
          id: `eval-link-${ownerId}-${link.kind}-${link.url}`,
          ...owner,
          kind: link.kind,
          url: link.url,
          label: link.label,
          official: link.official ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      )
      .run();
  }
}

function insertEdition(
  connection: SeedConnection,
  eventId: string,
  edition: SeedEdition,
) {
  const { client, db } = connection;
  db.insert(editions)
    .values(
      validateCatalogValues(client, "editions", {
        id: edition.id,
        eventId,
        editionKey: edition.editionKey,
        editionYear: edition.editionYear,
        displayName: edition.displayName,
        startsOn: edition.startsOn,
        endsOn: edition.endsOn,
        dateState:
          edition.dateState ?? (edition.startsOn ? "confirmed" : "unknown"),
        scheduleStatus:
          edition.scheduleStatus ??
          (edition.startsOn ? "scheduled" : "announced"),
        publicationState: edition.publicationState ?? "draft",
        countryCode: edition.countryCode,
        locality: edition.locality,
        administrativeArea: edition.administrativeArea,
        timeZone: edition.timeZone,
        sizeEstimate: edition.sizeEstimate,
        venueName: edition.venueName,
        venueAddress: edition.venueAddress,
        latitude: edition.latitude,
        longitude: edition.longitude,
        coordinatePrecision: edition.coordinatePrecision,
        ...ticketColumns(edition.tickets),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .run();
  for (const termId of edition.termIds ?? []) {
    db.insert(editionTerms)
      .values(
        validateCatalogValues(client, "edition_terms", {
          editionId: edition.id,
          termId,
        }),
      )
      .run();
  }
  insertLinks(connection, { editionId: edition.id }, edition.links);
}

function insertEvent(connection: SeedConnection, event: SeedEvent) {
  const { client, db } = connection;
  db.insert(events)
    .values(
      validateCatalogValues(client, "events", {
        id: event.id,
        slug: event.slug,
        canonicalName: event.canonicalName,
        aliases: event.aliases ?? [],
        description: event.description,
        shortDescription: event.shortDescription,
        homeScope: event.homeScope,
        publicationState: event.publicationState ?? "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .run();
  insertLinks(connection, { eventId: event.id }, event.links);
  for (const edition of event.editions) {
    insertEdition(connection, event.id, edition);
  }
}

export function seedDatabase(
  suite: EvalSuite,
  item: Pick<PipelineEvalCase, "initial">,
) {
  const connection = openDatabase(":memory:");
  const { client, db } = connection;
  try {
    migrateCatalogConnection(connection);
    db.transaction(() => {
      db.delete(taxonomyTerms).run();
      for (const term of suite.terms) {
        db.insert(taxonomyTerms)
          .values(validateCatalogValues(client, "taxonomy_terms", term))
          .run();
      }
      for (const event of [
        item.initial.event,
        ...(item.initial.relatedEvents ?? []),
      ]) {
        insertEvent(connection, event);
      }
    });
    return connection;
  } catch (error) {
    client.close();
    throw error;
  }
}

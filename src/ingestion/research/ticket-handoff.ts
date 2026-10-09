import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type { ResearchBudget } from "../runtime/budget";
import type { ReadSourceResult } from "../sources/contracts";
import type { MainDraft } from "./contracts";
import type { ResearchCatalog } from "./prepare";
import { savedTickets } from "./saved-tickets";

type MainData = NonNullable<MainDraft["data"]>;
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Structural membership only: the host does not decide page authority or truth. */
export function createTicketHandoff(
  data: MainData,
  event: ResearchCatalog[number] | undefined,
  reads: ReadSourceResult[],
  budget: ResearchBudget,
  todayUtc = new Date().toISOString().slice(0, 10),
) {
  // Deduplicate repeated page text, retaining every redirect alias and retrieval.
  // Distinct snapshots at the same URL retain their original text separately.
  const pages = new Map<
    string,
    {
      read: ReadSourceResult;
      aliases: Set<string>;
      retrievals: Omit<ReadSourceResult, "markdown" | "links">[];
    }
  >();
  for (const read of reads) {
    const key = normalizeCatalogUrl(read.finalUrl) + "\0" + read.markdown;
    const page = pages.get(key) ?? {
      read,
      aliases: new Set<string>(),
      retrievals: [],
    };
    page.aliases.add(normalizeCatalogUrl(read.attemptedUrl));
    page.aliases.add(normalizeCatalogUrl(read.finalUrl));
    const retrieval = {
      attemptedUrl: read.attemptedUrl,
      finalUrl: read.finalUrl,
      retrievedAt: read.retrievedAt,
      method: read.method,
      outcome: read.outcome,
      completeness: read.completeness,
      ...(read.reason ? { reason: read.reason } : {}),
    };
    page.retrievals.push(retrieval);
    pages.set(key, page);
  }
  const byUrl = new Map<
    string,
    typeof pages extends Map<string, infer V> ? V[] : never
  >();
  for (const page of pages.values()) {
    for (const alias of page.aliases) {
      byUrl.set(alias, [...(byUrl.get(alias) ?? []), page]);
    }
  }
  for (const edition of data.editions) {
    if (
      edition.ticketResearch.sourceUrls.some(
        (url) => !byUrl.has(normalizeCatalogUrl(url)),
      )
    ) {
      throw new Error("Ticket routing contains an unread source");
    }
  }
  const editions = data.editions
    .filter((edition) => edition.ticketResearch.state === "inspect")
    .map((edition) => {
      const saved = event?.editions.find(
        (item) => item.occurrenceKey === edition.key,
      );
      const fields = [
        "scheduleStatus",
        "displayName",
        "venueName",
        "venueAddress",
        "locality",
        "administrativeArea",
        "countryCode",
        "coordinates",
      ] as const;
      const location = Object.fromEntries(
        fields.map((field) => [field, overlaidField(edition, saved, field)]),
      );
      return {
        key: edition.key,
        event: {
          id: event?.id ?? null,
          name: event?.canonicalName ?? data.eventName,
          observedName: data.eventName,
          aliases: event?.aliases ?? [],
        },
        occurrenceId: saved?.id ?? null,
        year: edition.year?.value ?? saved?.occurrenceYear ?? null,
        dates: edition.dates ? edition.dates.value : savedDates(saved),
        ...location,
        ticketUrl:
          edition.links.tickets ||
          saved?.links.find((link) => link.kind === "ticketing")?.url ||
          null,
        ticketUrlReason: edition.ticketResearch.reason,
        routing: edition.ticketResearch,
        savedTickets: saved
          ? savedTickets(saved)
          : { variants: [], basePrice: null },
      };
    });
  const keysFor = (
    page: typeof pages extends Map<string, infer V> ? V : never,
  ) =>
    editions
      .filter((edition) =>
        edition.routing.sourceUrls.some((url) =>
          page.aliases.has(normalizeCatalogUrl(url)),
        ),
      )
      .map((edition) => edition.key);
  const sources = [...pages.values()]
    .filter((page) => keysFor(page).length > 0)
    .map(({ read, aliases, retrievals }) => ({
      attemptedUrl: read.attemptedUrl,
      finalUrl: read.finalUrl,
      retrievedAt: read.retrievedAt,
      method: read.method,
      outcome: read.outcome,
      completeness: read.completeness,
      ...(read.reason ? { reason: read.reason } : {}),
      markdown: read.markdown,
      aliases: [...aliases],
      retrievals,
      editionKeys: keysFor(
        pages.get(normalizeCatalogUrl(read.finalUrl) + "\0" + read.markdown)!,
      ),
    }));
  return freeze(
    structuredClone({
      todayUtc,
      remaining: budget.remaining(),
      editions,
      sources,
    }),
  );
}
export type TicketHandoff = ReturnType<typeof createTicketHandoff>;

function savedDates(
  saved: ResearchCatalog[number]["editions"][number] | undefined,
) {
  if (!saved?.startsOn || !saved.endsOn) {
    return null;
  }
  return {
    startsOn: saved.startsOn,
    endsOn: saved.endsOn,
    state: saved.dateState,
  };
}
// Packet fields deliberately preserve scalar or coordinate-object values.
// eslint-disable-next-line sonarjs/function-return-type
function overlaidField(
  edition: MainData["editions"][number],
  saved: ResearchCatalog[number]["editions"][number] | undefined,
  field:
    | "scheduleStatus"
    | "displayName"
    | "venueName"
    | "venueAddress"
    | "locality"
    | "administrativeArea"
    | "countryCode"
    | "coordinates",
) {
  if (edition[field]) {
    return edition[field].value;
  }
  if (field !== "coordinates") {
    return saved?.[field] ?? null;
  }
  if (saved?.latitude == null || saved.longitude == null) {
    return null;
  }
  return {
    latitude: saved.latitude,
    longitude: saved.longitude,
    precision: saved.coordinatePrecision,
  };
}

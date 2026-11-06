import type { z } from "zod";
import type { catalogPriceBlockSchema } from "@/catalog/operations/operation";
import type { CatalogResearchResult } from "../contracts";
import type { PipelineEvalCase } from "./fixtures";
import { check } from "./checks";

type Values = {
  links: { kind: string; url: string }[];
  terms: string[];
  price_details: z.infer<typeof catalogPriceBlockSchema>["priceDetails"];
  starts_on: string | null;
  ends_on: string | null;
  date_state: string | null;
  country_code: string | null;
  locality: string | null;
  venue_name: string | null;
  venue_address: string | null;
  description: string | null;
  short_description: string | null;
  size_estimate: number | null;
  price_min_minor: number | null;
  price_currency: string | null;
  price_kind: string | null;
  price_qualification: string | null;
};

/** Match dry-run mutations, including new Editions resolved through writer references. */
export function catalogChanges(
  item: PipelineEvalCase,
  report: CatalogResearchResult,
) {
  const matches = <K extends keyof Values>(
    subjects: Set<string>,
    field: K,
    predicate: (value: Values[K] | undefined) => boolean,
  ) =>
    report.changes.some(
      (change) =>
        subjects.has(change.subject) &&
        change.field === field &&
        predicate(change.newValue as Values[K]),
    );
  return {
    event: <K extends keyof Values>(
      field: K,
      predicate: (value: Values[K] | undefined) => boolean,
    ) => matches(new Set([item.initial.event.id]), field, predicate),
    edition: <K extends keyof Values>(
      selector: { key?: string; year?: number },
      field: K,
      predicate: (value: Values[K] | undefined) => boolean,
    ) => {
      const subjects = new Set(
        item.initial.event.editions
          .filter(
            (edition) =>
              (selector.key === undefined ||
                edition.editionKey === selector.key) &&
              (selector.year === undefined ||
                edition.editionYear === selector.year),
          )
          .map((edition) => edition.id),
      );
      for (const operation of report.operations) {
        if (
          operation.kind === "createEdition" &&
          operation.eventId === item.initial.event.id &&
          (selector.key === undefined ||
            operation.data.editionKey === selector.key) &&
          (selector.year === undefined ||
            operation.data.editionYear === selector.year)
        ) {
          const id = operation.tempKey
            ? report.references[operation.tempKey]
            : undefined;
          if (id) {
            subjects.add(id);
          }
        }
      }
      return matches(subjects, field, predicate);
    },
  };
}

export type CatalogChanges = ReturnType<typeof catalogChanges>;

export function officialWebsite(changes: CatalogChanges, urls: string[]) {
  return check(
    "catalog.event.website",
    changes.event(
      "links",
      (links) =>
        links?.some(
          (link) => link.kind === "official_site" && urls.includes(link.url),
        ) === true,
    ),
    `Set the official website to one of: ${urls.join(", ")}`,
  );
}

export function confirmedDates(
  changes: CatalogChanges,
  selector: { key?: string; year?: number },
  startsOn: string,
  endsOn: string,
) {
  return [
    check(
      "catalog.dates.start",
      changes.edition(selector, "starts_on", (value) => value === startsOn),
      `Set programme start to ${startsOn}`,
    ),
    check(
      "catalog.dates.end",
      changes.edition(selector, "ends_on", (value) => value === endsOn),
      `Set programme end to ${endsOn}`,
    ),
    check(
      "catalog.dates.state",
      changes.edition(selector, "date_state", (value) => value === "confirmed"),
      "Confirm the programme dates",
    ),
  ];
}

export function preserveDates(changes: CatalogChanges, key: string) {
  return (["starts_on", "ends_on"] as const).map((field) =>
    check(
      `catalog.${key}.${field}`,
      !changes.edition({ key }, field, (value) => value !== undefined),
      `Do not change or clear ${key}.${field}`,
    ),
  );
}

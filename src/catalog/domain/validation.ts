import { z } from "zod";
import { price } from "./price";
import {
  publicationStates,
  scopes,
  dateStates,
  scheduleStatuses,
  ticketAvailabilities,
  coordinatePrecisions,
  sourceKinds,
  sourceAuthorities,
  linkKinds,
  facets,
} from "./vocabulary";

type RecordValues = Record<string, unknown>;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
const state = z.enum(publicationStates).default("draft");
const scope = z.enum(scopes);
const occurrenceStates = z.object({
  publicationState: state,
  dateState: z.enum(dateStates).default("unknown"),
  scheduleStatus: z.enum(scheduleStatuses).default("announced"),
  ticketAvailability: z.enum(ticketAvailabilities).default("unknown"),
  coordinatePrecision: z.enum(coordinatePrecisions).default("unknown"),
});

export function validateEventRecord(r: RecordValues) {
  const publicationState = state.parse(r.publicationState);
  scope.nullish().parse(r.homeScope);
  assert(
    publicationState !== "published" || r.homeScope != null,
    "Published event needs home scope",
  );
}

/** Validate the entire stored block, including stray fields when kind is absent. */
export function validateStoredPrice(r: RecordValues) {
  const fields = [
    r.priceKind,
    r.priceCurrency,
    r.priceMinMinor,
    r.priceMaxMinor,
    r.priceCoverage,
    r.priceQualification,
  ];
  if (fields.every((value) => value == null)) {
    return;
  }
  assert(r.priceKind != null, "Incomplete price block");
  if (r.priceKind === "free") {
    assert(r.priceCurrency == null, "Free price cannot have currency");
  }
  price.parse({
    kind: r.priceKind,
    ...(r.priceKind === "free" ? {} : { currency: r.priceCurrency }),
    minMinor: r.priceMinMinor,
    maxMinor: r.priceMaxMinor,
    coverage: r.priceCoverage,
    ...(r.priceQualification == null
      ? {}
      : { qualification: r.priceQualification }),
  });
}

export function validateOccurrenceRecord(r: RecordValues) {
  const states = occurrenceStates.parse(r);
  assert(
    (r.startsOn == null) === (r.endsOn == null),
    "Date pair is incomplete",
  );
  assert(
    r.startsOn == null
      ? states.dateState === "unknown"
      : states.dateState === "provisional" || states.dateState === "confirmed",
    "Date state conflicts with dates",
  );
  assert(
    r.startsOn == null ||
      (typeof r.startsOn === "string" &&
        typeof r.endsOn === "string" &&
        r.endsOn >= r.startsOn),
    "End date precedes start date",
  );
  assert(
    states.scheduleStatus !== "scheduled" || r.startsOn != null,
    "Scheduled occurrence needs dates",
  );
  assert(
    (r.latitude == null) === (r.longitude == null),
    "Coordinate pair is incomplete",
  );
  assert(
    r.latitude == null
      ? states.coordinatePrecision === "unknown"
      : states.coordinatePrecision !== "unknown",
    "Coordinate precision conflicts with coordinates",
  );
  z.number().min(-90).max(90).nullish().parse(r.latitude);
  z.number().min(-180).max(180).nullish().parse(r.longitude);
  if (states.publicationState === "published") {
    assert(
      r.startsOn != null && r.endsOn != null && r.occurrenceYear != null,
      "Publication needs supported dates and year",
    );
    assert(
      r.countryCode != null &&
        (r.venueName != null ||
          r.locality != null ||
          r.administrativeArea != null),
      "Publication needs country and supported area",
    );
  }
  validateStoredPrice(r);
}
export function validateSourceRecord(r: RecordValues) {
  z.enum(sourceKinds).parse(r.kind);
  z.enum(sourceAuthorities).parse(r.authority);
}
export function validateLinkRecord(r: RecordValues) {
  z.enum(linkKinds).parse(r.kind);
}
export function validateAliasRecord(r: RecordValues) {
  scope.parse(r.scope);
}

export type TaxonomyTerm = {
  id: string;
  facet: string;
  parentId?: string | null;
};
/** Relations are supplied from the same transaction as the proposed write. */
export function validateTaxonomyTerm(
  term: TaxonomyTerm,
  parent?: TaxonomyTerm,
  children: readonly TaxonomyTerm[] = [],
) {
  z.enum(facets).parse(term.facet);
  if (term.parentId != null) {
    assert(parent?.id === term.parentId, "Unknown taxonomy parent");
    assert(
      parent.facet === term.facet,
      "Taxonomy parent must be in same facet",
    );
  }
  assert(
    children.every((child) => child.facet === term.facet),
    "Taxonomy children must be in same facet",
  );
}
export function validateTermAssignments(terms: readonly TaxonomyTerm[]) {
  for (const term of terms) {
    z.enum(facets).parse(term.facet);
  }
  for (const facet of ["event_type", "format"]) {
    assert(
      terms.filter((term) => term.facet === facet).length <= 1,
      `Only one ${facet} term allowed`,
    );
  }
}

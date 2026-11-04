import { z } from "zod";
import {
  latitude,
  longitude,
  sizeEstimate,
  editionScalarSchemas,
} from "./edition-values";
import { priceDetails, validateStoredPrice } from "./price";
import {
  publicationStates,
  dateStates,
  scheduleStatuses,
  coordinatePrecisions,
  type facets,
} from "./vocabulary";

type RecordValues = Record<string, unknown>;
type Facet = (typeof facets)[number];
type AssignedTerms = readonly { facet: string }[];
type PublicationPolicy = {
  requiredFields: readonly {
    field: keyof typeof editionScalarSchemas;
    message: string;
  }[];
  requiredFacetGroups: readonly {
    anyOf: readonly [Facet, ...Facet[]];
    message: string;
  }[];
};

const editionStates = z.object({
  publicationState: z.enum(publicationStates).default("draft"),
  dateState: z.enum(dateStates).default("unknown"),
  scheduleStatus: z.enum(scheduleStatuses).default("announced"),
  coordinatePrecision: z.enum(coordinatePrecisions).default("unknown"),
});
const optionalPriceDetails = priceDetails.optional();

type RecordCondition = {
  accepts: (
    row: RecordValues,
    states: z.infer<typeof editionStates>,
  ) => boolean;
  message: string;
};

const recordConditions: readonly RecordCondition[] = [
  {
    accepts: (row) => (row.startsOn == null) === (row.endsOn == null),
    message: "Date pair is incomplete",
  },
  {
    accepts: (row, { dateState }) =>
      row.startsOn == null
        ? dateState === "unknown"
        : dateState === "provisional" || dateState === "confirmed",
    message: "Date state conflicts with dates",
  },
  {
    accepts: (row) =>
      row.startsOn == null ||
      (typeof row.startsOn === "string" &&
        typeof row.endsOn === "string" &&
        row.endsOn >= row.startsOn),
    message: "End date precedes start date",
  },
  {
    accepts: (row, { scheduleStatus }) =>
      scheduleStatus !== "scheduled" || row.startsOn != null,
    message: "Scheduled edition needs dates",
  },
  {
    accepts: (row) => (row.latitude == null) === (row.longitude == null),
    message: "Coordinate pair is incomplete",
  },
  {
    accepts: (row, { coordinatePrecision }) =>
      (row.latitude == null) === (coordinatePrecision === "unknown"),
    message: "Coordinate precision conflicts with coordinates",
  },
];

export function defineEditionRules(policy: PublicationPolicy) {
  function validateRecord(row: RecordValues) {
    const states = editionStates.parse(row);
    for (const [field, schema] of Object.entries(editionScalarSchemas)) {
      schema.parse(row[field]);
    }
    sizeEstimate.parse(row.sizeEstimate);
    optionalPriceDetails.parse(row.priceDetails);
    for (const condition of recordConditions) {
      if (!condition.accepts(row, states)) {
        throw new Error(condition.message);
      }
    }
    latitude.parse(row.latitude);
    longitude.parse(row.longitude);
    if (states.publicationState === "published") {
      for (const { field, message } of policy.requiredFields) {
        if (row[field] == null) {
          throw new Error(message);
        }
      }
    }
    validateStoredPrice(row);
  }

  function validateFacets(terms: AssignedTerms) {
    for (const { anyOf, message } of policy.requiredFacetGroups) {
      if (!anyOf.some((facet) => terms.some((term) => term.facet === facet))) {
        throw new Error(message);
      }
    }
  }

  function isPublishable(row: RecordValues, terms: AssignedTerms) {
    try {
      validateRecord({ ...row, publicationState: "published" });
      validateFacets(terms);
      return true;
    } catch {
      return false;
    }
  }

  return { validateRecord, validateFacets, isPublishable };
}

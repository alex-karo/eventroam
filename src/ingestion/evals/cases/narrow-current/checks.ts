import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  editionByYear,
  returned,
  omittedEventFields,
  oneNewEdition,
  refusedResearch,
} from "../../research";
import { check } from "../../checks";

export const checks = {
  "narrow-current-stable": (context) => {
    const { data, changes } = context;
    const edition = editionByKey(data, "2027");
    return [
      check(
        "catalog.edition.2027.venue_name.set.1",
        changes.edition(
          { key: "2027" },
          "venue_name",
          (value) => value === "New Grounds",
        ),
        'Set 2027 venue name to "New Grounds"',
      ),
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      check(
        "catalog.edition.2027.terms.preserve.3",
        !changes.edition({ key: "2027" }, "terms", (value) => value != null),
        "Preserve 2027 classification",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      ...omittedEventFields(data),
      check(
        "research.2027.sizeEstimate",
        !!edition && edition.sizeEstimate == null,
        "Omitted 2027.sizeEstimate",
      ),
      check(
        "research.2027.venueAddress",
        !!edition && edition.venueAddress == null,
        "Omitted 2027.venueAddress",
      ),
      check(
        "research.2027.coordinates",
        !!edition && edition.coordinates == null,
        "Omitted 2027.coordinates",
      ),
    ];
  },
  "narrow-current-reuse": (context) => {
    const { data, changes } = context;
    const edition = editionByYear(data, 2027);
    return [
      check(
        "catalog.edition.2027.terms.set.1",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:festival") === true,
        ),
        "Include validation:festival in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.2",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:openair") === true,
        ),
        "Include validation:openair in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.3",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:music") === true,
        ),
        "Include validation:music in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.4",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:electronic") ===
            true,
        ),
        "Include catalog:term:genre:electronic in 2027 classification",
      ),
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      researchStatus(context, "success"),
      oneNewEdition(context, 2027),
      ...[
        "validation:festival",
        "validation:openair",
        "validation:music",
        "catalog:term:genre:electronic",
      ].map((term) =>
        returned("research.2027.classification", edition?.classification, term),
      ),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-06-04",
        endsOn: "2027-06-05",
        state: "confirmed",
      }),
      ...omittedEventFields(data),
    ];
  },
  "narrow-current-changed": (context) => {
    const { data, changes } = context;
    const edition = editionByYear(data, 2027);
    return [
      check(
        "catalog.edition.2027.terms.set.1",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:festival") === true,
        ),
        "Include validation:festival in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.2",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:mixed") === true,
        ),
        "Include validation:mixed in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.3",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:music") === true,
        ),
        "Include validation:music in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.4",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:metal") === true,
        ),
        "Include catalog:term:genre:metal in 2027 classification",
      ),
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      check(
        "catalog.edition.2027.terms.preserve.3",
        !changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:openair") === true,
        ),
        "Exclude unsupported classification for 2027",
      ),
      check(
        "catalog.edition.2027.terms.preserve.4",
        !changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:electronic") ===
            true,
        ),
        "Exclude unsupported classification for 2027",
      ),
      researchStatus(context, "success"),
      oneNewEdition(context, 2027),
      ...[
        "validation:festival",
        "validation:mixed",
        "validation:music",
        "catalog:term:genre:metal",
      ].map((term) =>
        returned("research.2027.classification", edition?.classification, term),
      ),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-06-04",
        endsOn: "2027-06-05",
        state: "confirmed",
      }),
      ...omittedEventFields(data),
    ];
  },
  "narrow-current-noncomparable": (context) => {
    const { data, changes } = context;
    const edition = editionByYear(data, 2027);
    return [
      check(
        "catalog.edition.2027.terms.set.1",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:festival") === true,
        ),
        "Include validation:festival in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.2",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:openair") === true,
        ),
        "Include validation:openair in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.3",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "validation:music") === true,
        ),
        "Include validation:music in 2027 classification",
      ),
      check(
        "catalog.edition.2027.terms.set.4",
        changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:electronic") ===
            true,
        ),
        "Include catalog:term:genre:electronic in 2027 classification",
      ),
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      check(
        "catalog.edition.2027.terms.preserve.3",
        !changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:metal") === true,
        ),
        "Exclude unsupported classification for 2027",
      ),
      researchStatus(context, "success"),
      oneNewEdition(context, 2027),
      ...[
        "validation:festival",
        "validation:openair",
        "validation:music",
        "catalog:term:genre:electronic",
      ].map((term) =>
        returned("research.2027.classification", edition?.classification, term),
      ),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-06-04",
        endsOn: "2027-06-05",
        state: "confirmed",
      }),
      ...omittedEventFields(data),
    ];
  },
  "narrow-current-none": (context) => {
    const { report, data, changes } = context;
    return [
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      check(
        "catalog.edition.2026.starts_on.preserve.3",
        !changes.edition(
          { key: "2026" },
          "starts_on",
          (value) => value != null,
        ),
        "Preserve 2026 programme start",
      ),
      check(
        "catalog.edition.2026.ends_on.preserve.4",
        !changes.edition({ key: "2026" }, "ends_on", (value) => value != null),
        "Preserve 2026 programme end",
      ),
      check(
        "catalog.edition.2026.terms.preserve.5",
        !changes.edition({ key: "2026" }, "terms", (value) => value != null),
        "Preserve 2026 classification",
      ),
      check(
        "catalog.edition.2026.venue_name.preserve.6",
        !changes.edition(
          { key: "2026" },
          "venue_name",
          (value) => value != null,
        ),
        "Preserve 2026 venue name",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, null, null),
      ...omittedEventFields(data),
      check(
        "research.changes",
        report.changes.length === 0,
        "Expected no catalog changes",
      ),
    ];
  },
  "narrow-current-partial-tickets": (context) => {
    const { report, data, changes } = context;
    const edition = editionByKey(data, "2027");
    return [
      check(
        "catalog.edition.2027.venue_name.set.1",
        changes.edition(
          { key: "2027" },
          "venue_name",
          (value) => value === "New Grounds",
        ),
        'Set 2027 venue name to "New Grounds"',
      ),
      check(
        "catalog.edition.2027.price_details.set.2",
        changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            !value?.some((item) => item.label === "Student") &&
            value?.some(
              (item) => item.amount === 110 && item.currency === "EUR",
            ) === true,
        ),
        "Include the supported ticket offers for 2027 without the unsupported offer",
      ),
      check(
        "catalog.edition.2027.price_min_minor.set.3",
        changes.edition(
          { key: "2027" },
          "price_min_minor",
          (value) => value === 11000,
        ),
        "Set 2027 base price in minor units to 11000",
      ),
      check(
        "catalog.event.summary.preserve.1",
        !changes.event("summary", (value) => value != null),
        "Preserve Event summary",
      ),
      check(
        "catalog.event.links.preserve.2",
        !changes.event("links", (value) => value != null),
        "Preserve Event links",
      ),
      check(
        "catalog.edition.2027.price_qualification.preserve.3",
        !changes.edition(
          { key: "2027" },
          "price_qualification",
          (value) => value != null,
        ),
        "Preserve 2027 price qualification",
      ),
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.tickets", edition?.tickets, {
        variants: { amount: 110, currency: "EUR" },
        basePrice: {
          kind: "exact",
          currency: "EUR",
          minMinor: 11000,
          maxMinor: 11000,
          coverage: "full_programme",
        },
      }),
      ...omittedEventFields(data),
      check(
        "research.unresolved.2027",
        report.unresolved.some(
          (question) =>
            question.editionKey === "2027" &&
            question.message.trim().length > 0,
        ),
        "Unfinished 2027",
      ),
      check(
        "research.unresolved",
        report.unresolved.some(
          (question) => question.message.trim().length > 0,
        ),
        "Has unresolved questions=true",
      ),
    ];
  },
  "current-identity-contradiction": (context) => {
    const { item, report } = context;
    return [
      ...refusedResearch(report, "partial"),
      check(
        "research.editorStatus",
        report.editorStatus === "not_run",
        "Expected identity conflict to skip editing",
      ),
      check(
        "research.searches",
        report.budget.searches === 0,
        "Expected identity conflict to stop without search",
      ),
      check(
        "research.sources.available",
        report.sources.some((source) => source.outcome === "ok"),
        "Expected identity conflict evidence from an available source",
      ),
      check(
        "research.sources.allowed",
        report.sources.every((source) =>
          item.sources.some(
            (expected) => expected.attemptedUrl === source.attemptedUrl,
          ),
        ),
        "Expected identity conflict to inspect only fixture sources",
      ),
      check(
        "research.identity",
        report.unresolved.some(
          (question) =>
            question.field === "identity" && /full/i.test(question.message),
        ),
        "Expected an unresolved identity question directing a full refresh",
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;

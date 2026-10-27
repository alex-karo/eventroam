import {
  researchStatus,
  editionSlots,
  editionByKey,
  editionByYear,
  returned,
  omittedEventFields,
  oneNewEdition,
  refusedResearch,
  type ResearchEvaluator,
} from "../../research";
import { check } from "../../checks";

export const researchChecks = {
  "narrow-current-stable": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "2027");
    return [
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
    const { data } = context;
    const edition = editionByYear(data, 2027);
    return [
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
    const { data } = context;
    const edition = editionByYear(data, 2027);
    return [
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
    const { data } = context;
    const edition = editionByYear(data, 2027);
    return [
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
    const { report, data } = context;
    return [
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
    const { report, data } = context;
    const edition = editionByKey(data, "2027");
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.tickets", edition?.tickets, {
        variants: { amount: 110, currency: "EUR" },
        basePrice: {
          kind: "exact",
          currency: "EUR",
          minAmount: 110,
          maxAmount: 110,
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
      ...refusedResearch(report),
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
} satisfies Record<string, ResearchEvaluator>;

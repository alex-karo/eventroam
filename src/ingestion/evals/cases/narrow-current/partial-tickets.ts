import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  omittedEventFields,
} from "../../research";
import { check } from "../../checks";
import { preserveEventFields } from "./checks";
import { narrowFixture, narrowPage, summer2027 } from "./fixture";

const withSavedTickets = narrowFixture("partial-tickets", [
  {
    ...summer2027,
    tickets: {
      priceDetails: [
        {
          label: "Regular",
          amount: 100,
          currency: "EUR",
          availability: "available",
          terms: "Full programme",
        },
        {
          label: "Student",
          amount: 60,
          currency: "EUR",
          availability: "available",
          terms: "Student ID; full programme",
        },
      ],
      basePrice: {
        kind: "exact",
        currency: "EUR",
        minMinor: 10000,
        maxMinor: 10000,
        coverage: "full_programme",
      },
    },
  },
]);

export const narrowCurrentPartialTicketsCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    ...withSavedTickets,
    sources: [
      ...withSavedTickets.sources,
      {
        ...narrowPage("checkout"),
        status: "failed",
        reasonCode: "checkout_requires_login",
      },
    ],
  },
  evaluate(context) {
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
            value?.length === 1 &&
            value[0].label !== "Student" &&
            value[0].amount === 110 &&
            value[0].currency === "EUR",
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
      ...preserveEventFields(changes),
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
};

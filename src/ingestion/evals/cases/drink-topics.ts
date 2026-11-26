import type { Targets } from "../../roles/general/contracts";
import { evidenceRequirement } from "../reader/checks";

const wine =
  "The 2027 wine programme offers tastings led by eight regional wineries on both days.";
const cooking =
  "The 2027 cooking programme offers chef-led workshops on both days. Participants prepare regional dishes.";
const beer =
  "The 2027 beer programme offers guided tastings led by six independent breweries and brewing demonstrations.";
const indoors =
  "The entire 2027 main programme takes place inside enclosed exhibition halls.";
const bar =
  "The 2027 main programme consists of jazz concerts. The venue bar sells wine and beer. A brewery sponsors the concerts and offers one sample at its stand.";
const past =
  "In 2026, six independent breweries led a full programme of beer tastings and demonstrations.";

const scenarios = [
  {
    id: "classification-wine-culinary-open-air",
    name: "Vineyard Table Open Air",
    programme: [wine, cooking],
    passages: [wine, cooking],
    terms: ["catalog:term:topic:wine", "validation:openair"],
    descriptionReference:
      "An open-air festival with a substantial programme of wine tastings and separate chef-led cooking workshops.",
    culinary: true,
  },
  {
    id: "classification-beer-indoor-despite-name",
    name: "Malt Festival Open Air",
    programme: [
      beer,
      `${indoors} Outside there are only entrances and parking.`,
    ],
    passages: [beer, indoors],
    terms: ["catalog:term:topic:beer", "validation:indoor"],
    descriptionReference:
      "An indoor beer festival in enclosed exhibition halls, with guided tastings from independent breweries and brewing demonstrations.",
  },
  {
    id: "classification-wine-name-only",
    name: "Alder Wine Festival",
    programme: [],
    passages: [],
    terms: [],
  },
  {
    id: "classification-drinks-incidental",
    name: "Alder Jazz Festival",
    programme: [bar],
    passages: [bar],
    terms: ["validation:music"],
  },
  {
    id: "classification-beer-other-edition",
    name: "Mill Beer Festival",
    programme: [past],
    passages: [past],
    terms: [],
  },
];

export function drinkClassificationCases() {
  return scenarios.map((scenario) => {
    const url = `https://drink-fixtures.example/${scenario.id}`;
    const todayUtc = "2027-01-01";
    const editionKey = "2027";
    const targets: Targets = {
      decision: "targets",
      eventId: scenario.id,
      observedEventName: scenario.name,
      reason: "The organizer names the festival and its upcoming Edition.",
      evidenceIds: [],
      previousEdition: null,
      currentOrNextEdition: {
        editionKey,
        reason: "The dates identify the selected Edition.",
        evidenceIds: [],
        fields: {},
      },
      checks: [],
      unresolved: [],
    };
    return {
      id: scenario.id,
      suite: "regression" as const,
      origin: "synthetic" as const,
      task: "Read the official page and classify the selected Edition",
      provenance: {
        kind: "synthetic-classification-regression",
        note: "Use a fixed organizer page and selected Edition.",
      },
      input: {
        mode: "refresh" as const,
        scope: "full" as const,
        eventId: scenario.id,
        actor: "eval",
      },
      todayUtc,
      initial: {
        event: {
          id: scenario.id,
          slug: scenario.id,
          canonicalName: scenario.name,
          editions: [{ id: `${scenario.id}-2027`, editionKey }],
        },
      },
      classification: {
        targets,
        source: {
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: `${todayUtc}T00:00:00.000Z`,
          method: "http" as const,
          status: "ok" as const,
          markdown: [
            `# ${scenario.name}`,
            "The festival takes place on 5–6 June 2027.",
            ...scenario.programme,
          ].join("\n\n"),
        },
        requirements: [
          evidenceRequirement("official-name", "classification", scenario.name),
          ...scenario.passages.map((passage, index) =>
            evidenceRequirement(
              `programme-${index + 1}`,
              "classification",
              passage,
            ),
          ),
        ],
        expectedTerms: ["validation:festival", ...scenario.terms],
        allowNoClassification: scenario.terms.length === 0,
        descriptionReference: scenario.descriptionReference,
        culinary: scenario.culinary,
      },
    };
  });
}

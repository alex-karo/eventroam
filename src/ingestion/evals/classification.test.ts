import { expect, it } from "vitest";
import { bindEvidence } from "../evidence/contracts";
import { evidenceRequirement } from "./reader/checks";
import {
  scoreClassification,
  type ClassificationEvalCase,
} from "./classification";

const festival = "test:festival";
const craft = "test:craft";
const music = "test:music";
const name = "Copper Craft Festival";
const past = "The 2026 programme offered craft workshops across three days.";
const date = "The next Edition takes place on 5 June 2027.";
const url = "https://fixture.example/";
const markdown = [name, past, date].join("\n\n");
const { evidence } = bindEvidence(
  "s1",
  markdown,
  {
    evidence: [
      { quote: name, topics: ["classification"] },
      { quote: past, topics: ["classification"] },
      { quote: date, topics: ["dates"] },
    ],
    limitations: [],
  },
  url,
);
const [nameId, pastId, dateId] = evidence.map(({ id }) => id);
const requirements = [
  evidenceRequirement("official name", "classification", name),
  evidenceRequirement("earlier programme", "classification", past),
];

const fixture = {
  id: "classification-citations-test",
  suite: "regression",
  origin: "synthetic",
  task: "Classify the selected Edition",
  input: { mode: "refresh", scope: "full", eventId: "event", actor: "eval" },
  todayUtc: "2027-01-01",
  provenance: { kind: "test", note: "Use a fixed source and Edition." },
  initial: {
    event: {
      id: "event",
      slug: "event",
      canonicalName: name,
      editions: [{ id: "edition", editionKey: "2027" }],
    },
  },
  classification: {
    targets: {
      decision: "targets",
      eventId: "event",
      observedEventName: name,
      reason: "The announcement identifies the event.",
      evidenceIds: [nameId],
      previousEdition: null,
      currentOrNextEdition: null,
      checks: [],
      unresolved: [],
    },
    source: {
      attemptedUrl: url,
      finalUrl: url,
      retrievedAt: "2027-01-01T00:00:00.000Z",
      method: "http",
      status: "ok",
      markdown,
    },
    requirements,
    expectedTermSets: [[festival], [festival, craft], []],
    citationRequirement: { termId: craft, evidence: requirements },
    descriptionReference: undefined,
    culinary: undefined,
  },
} satisfies ClassificationEvalCase;

const terms = [
  { id: festival, facet: "event_type", slug: "festival", parentId: null },
  { id: craft, facet: "topic", slug: "craft", parentId: null },
  { id: music, facet: "topic", slug: "music", parentId: null },
] as const;

it.each([
  ["accepts a term set without the optional topic", [festival], [], true],
  [
    "accepts the optional topic with both citations",
    [festival, craft],
    [nameId, pastId],
    true,
  ],
  [
    "rejects the optional topic without citations",
    [festival, craft],
    [],
    false,
  ],
  [
    "rejects the optional topic with only the official name",
    [festival, craft],
    [nameId],
    false,
  ],
  [
    "rejects the optional topic with only the earlier programme",
    [festival, craft],
    [pastId],
    false,
  ],
  [
    "rejects unrelated support for the official name",
    [festival, craft],
    [dateId, pastId],
    false,
  ],
  [
    "rejects a term set with an extra topic",
    [festival, craft, music],
    [nameId, pastId],
    false,
  ],
  [
    "rejects duplicate terms even when no terms are allowed",
    [craft, craft],
    [nameId, pastId],
    false,
  ],
])("%s", async (_name, value, evidenceIds, passed) => {
  const { score } = await scoreClassification(
    fixture,
    {
      status: "success",
      model: "fixture",
      promptVersion: "fixture",
      modelResponse: null,
      errors: [],
      durationMs: 0,
      output: {
        previousEdition: null,
        currentOrNextEdition: {
          classification: {
            action: "set",
            value,
            reason: "Assess the sources for the proposed terms.",
            evidenceIds,
          },
        },
        checks: [],
        unresolved: [],
      },
    },
    [...terms],
    evidence,
  );

  expect(score.passed).toBe(passed);
});

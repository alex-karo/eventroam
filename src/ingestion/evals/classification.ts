import { bindEvidence, type FrozenCorpus } from "../evidence/contracts";
import type { Targets, ClassificationOutput } from "../roles/contracts";
import type { RoleExecution } from "../roles/invoke";
import { check, scenarioResult } from "./checks";
import {
  assessDescriptionFormat,
  descriptionFields,
  minimumDescriptionFormat,
} from "./description-format";
import type { EvalSuite } from "./fixtures";

export function classificationCases(suite: EvalSuite) {
  const parent = suite.cases.find(
    (item) => item.id === "narrow-current-changed",
  );
  const source = parent?.sources.find(
    (item) => item.finalUrl === "https://narrow-fixture.example/changed",
  );
  if (!parent?.initial || source?.status !== "ok") {
    throw new Error(
      "Classification case needs the River Festival announcement",
    );
  }
  const { markdown, ...metadata } = source;
  const bound = bindEvidence(
    "s1",
    markdown,
    {
      limitations: [],
      evidence: [
        {
          quote:
            "Confirmed 4–5 June 2027, New Grounds, Lisbon, Portugal. Both days are free, no tickets or paid categories. This is the only upcoming edition. The 2027 programme changes completely: exclusively metal music, with the main programme split evenly between enclosed indoor and open-air stages. The former electronic programme and exclusively open-air format have ended.",
          topics: ["dates", "classification", "description"],
        },
      ],
    },
    source.finalUrl,
  );
  if (bound.limitations.length || bound.evidence.length !== 1) {
    throw new Error(
      "Classification evidence must match the River Festival source",
    );
  }
  const evidenceIds = bound.evidence.map(({ id }) => id);
  const event = {
    ...parent.initial.event,
    description: "River Festival is an open-air electronic music festival.",
    shortDescription: "River Festival is an outdoor electronic music festival.",
  };
  const corpus: FrozenCorpus = {
    version: "classification-eval-v1",
    sources: [
      {
        ...metadata,
        id: "s1",
        processing: "complete",
        limitations: [],
      },
    ],
    evidence: bound.evidence,
  };
  const targets: Targets = {
    decision: "targets",
    eventId: event.id,
    observedEventName: event.canonicalName,
    reason: "The official announcement names River Festival.",
    evidenceIds,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      reason: "The announcement confirms the only upcoming edition.",
      evidenceIds,
      fields: {},
    },
    checks: [],
    unresolved: [],
  };
  return [
    {
      id: "classification-river-format-change",
      suite: "regression" as const,
      origin: parent.origin,
      task: "Classify the announced programme and update both descriptions",
      input: { ...parent.input, scope: "full" as const },
      todayUtc: parent.todayUtc,
      provenance: {
        kind: "synthetic-classification-regression",
        note: "Reuse the narrow-current-changed announcement and saved Edition. Fix the target and seed both texts with the former format.",
      },
      initial: { event },
      classification: {
        targets,
        corpus,
        expectedTerms: [
          "validation:festival",
          "validation:music",
          "validation:mixed",
          "catalog:term:genre:metal",
        ],
        descriptionReference:
          "River Festival is a metal music festival with substantial programmes on both indoor and outdoor stages.",
      },
    },
  ];
}

export type ClassificationEvalCase = ReturnType<
  typeof classificationCases
>[number];

const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });

export async function scoreClassification(
  item: ClassificationEvalCase,
  execution: RoleExecution<ClassificationOutput>,
) {
  const { expectedTerms, descriptionReference } = item.classification;
  const actual = execution.output?.currentOrNextEdition?.classification?.value;
  const texts = Object.fromEntries(
    descriptionFields.map((field) => {
      const proposal = execution.output?.[field];
      return [field, proposal?.action === "set" ? proposal.value : null];
    }),
  );
  const descriptionFormat = await assessDescriptionFormat(
    descriptionReference,
    texts,
  );
  const festivalName = item.initial.event.canonicalName.toLowerCase();
  return {
    descriptionFormat,
    score: scenarioResult([
      check(
        "execution",
        execution.status === "success" && execution.errors.length === 0,
        "Classification must return a valid result",
      ),
      check(
        "currentOrNextEdition.classification",
        actual?.length === expectedTerms.length &&
          expectedTerms.every((term) => actual.includes(term)),
        `Expected ${expectedTerms.join(", ")}. Received ${actual?.join(", ") || "no categories"}.`,
      ),
      ...descriptionFields.flatMap((field) => {
        const probability = descriptionFormat.fields[field];
        const format = check(
          field,
          typeof probability === "number" &&
            probability >= minimumDescriptionFormat,
          `Decider result: ${probability}. Required minimum is ${minimumDescriptionFormat}.`,
        );
        const text = texts[field];
        if (!text) {
          return [format];
        }
        const [min, max] = field === "description" ? [3, 5] : [1, 2];
        const count = [...sentenceSegmenter.segment(text)].length;
        return [
          format,
          check(
            `${field}.length`,
            count >= min && count <= max,
            `Expected ${min}–${max} sentences. Received ${count}.`,
          ),
          check(
            `${field}.festivalName`,
            !text.toLowerCase().includes(festivalName),
            "The text must omit the festival name.",
          ),
        ];
      }),
    ]),
  };
}

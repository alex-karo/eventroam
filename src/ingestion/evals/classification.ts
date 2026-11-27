import { normalizeProposedAssignments } from "@/catalog/domain/classification";
import {
  bindEvidence,
  type Evidence,
  type FrozenCorpus,
} from "../evidence/contracts";
import type { ResearchContext } from "../research/context";
import type { Targets } from "../roles/general/contracts";
import type { ClassificationOutput } from "../roles/classification/contracts";
import type { RoleExecution } from "../roles/invoke";
import { check, scenarioResult, type Check } from "./checks";
import {
  assessDescriptionFormat,
  descriptionFields,
  minimumDescriptionFormat,
} from "./description-format";
import type { EvalSuite } from "./fixtures";
import { drinkClassificationCases } from "./cases/drink-topics";
import { checkEvidence } from "./reader/checks";

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
        {
          quote:
            "The 2027 edition is a live metal music festival. Emerging bands perform on the indoor stages. The open-air stages feature extended live sets.",
          topics: ["classification", "description"],
        },
      ],
    },
    source.finalUrl,
  );
  if (bound.limitations.length || bound.evidence.length !== 2) {
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
        expectedTermSets: [
          [
            "validation:festival",
            "validation:music",
            "validation:mixed",
            "catalog:term:genre:metal",
          ],
        ],
        descriptionReference:
          "A live metal music festival split evenly between indoor and open-air stages. Emerging bands play indoors, and open-air stages host extended live sets.",
      },
    },
    ...drinkClassificationCases(),
  ];
}

export type ClassificationEvalCase = ReturnType<
  typeof classificationCases
>[number];

const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });

function checkClassificationTerms(
  fixture: ClassificationEvalCase["classification"],
  proposed: string[] | undefined,
  terms: ResearchContext["terms"],
) {
  const path = "currentOrNextEdition.classification";
  let actual: string[];
  try {
    actual = normalizeProposedAssignments(proposed ?? [], terms).retained;
  } catch (error) {
    return check(path, false, `Invalid classification: ${String(error)}`);
  }
  const { expectedTermSets } = fixture;
  const expected = expectedTermSets
    .map((terms) => terms.join(", ") || "no categories")
    .join(" or ");
  return check(
    path,
    expectedTermSets.some(
      (terms) =>
        actual.length === terms.length &&
        terms.every((id) => actual.includes(id)),
    ),
    `Expected ${expected}. Received ${actual.join(", ") || "no categories"}.`,
  );
}

async function scoreClassificationDescriptions(
  item: ClassificationEvalCase,
  texts: Record<(typeof descriptionFields)[number], string | null>,
) {
  const { descriptionReference } = item.classification;
  const descriptionFormat = await assessDescriptionFormat(
    descriptionReference,
    texts,
  );
  const checks: Check[] = [];
  if (!descriptionReference) {
    return { checks, descriptionFormat };
  }

  const festivalName = item.initial.event.canonicalName.toLowerCase();
  for (const field of descriptionFields) {
    const probability = descriptionFormat.fields[field];
    checks.push(
      check(
        field,
        typeof probability === "number" &&
          probability >= minimumDescriptionFormat,
        `Decider result: ${probability}. Required minimum is ${minimumDescriptionFormat}.`,
      ),
    );
    const text = texts[field];
    if (!text) {
      continue;
    }
    const [min, max] = field === "description" ? [3, 5] : [1, 2];
    const count = [...sentenceSegmenter.segment(text)].length;
    checks.push(
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
    );
  }
  return { checks, descriptionFormat };
}

export async function scoreClassification(
  item: ClassificationEvalCase,
  execution: RoleExecution<ClassificationOutput>,
  terms: ResearchContext["terms"],
  evidence: Evidence[],
) {
  const { output } = execution;
  const fixture = item.classification;
  const proposal = output?.currentOrNextEdition?.classification;
  const classification = checkClassificationTerms(
    fixture,
    proposal?.value,
    terms,
  );
  const { description, shortDescription } = output ?? {};
  const texts = {
    description: description?.action === "set" ? description.value : null,
    shortDescription:
      shortDescription?.action === "set" ? shortDescription.value : null,
  };
  const { checks, descriptionFormat } = await scoreClassificationDescriptions(
    item,
    texts,
  );
  const citationRequirement =
    "citationRequirement" in fixture ? fixture.citationRequirement : undefined;
  if (
    citationRequirement &&
    proposal?.value.includes(citationRequirement.termId)
  ) {
    const cited = evidence.filter(({ id }) =>
      proposal.evidenceIds.includes(id),
    );
    const citationChecks = checkEvidence(citationRequirement.evidence, cited);
    checks.push(
      check(
        `${classification.path}.evidence`,
        citationChecks.every(({ passed }) => passed),
        `Cite the ${citationRequirement.evidence.map(({ name }) => name).join(" and ")} when proposing ${citationRequirement.termId}.`,
      ),
    );
  }
  return {
    descriptionFormat,
    score: scenarioResult([
      check(
        "execution",
        execution.status === "success" && execution.errors.length === 0,
        "Classification must return a valid result",
      ),
      classification,
      ...("culinary" in item.classification && item.classification.culinary
        ? [
            check(
              "description.culinary",
              /\b(?:chef[- ]led workshops?|cooking|culinary (?:sessions?|classes|workshops?)|prepar(?:e|ing) regional dishes|learn(?:ing)? regional recipes)\b/i.test(
                texts.description ?? "",
              ),
              "The full description must include the separate cooking programme.",
            ),
          ]
        : []),
      ...checks,
    ]),
  };
}

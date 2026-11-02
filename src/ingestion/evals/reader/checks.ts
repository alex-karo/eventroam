import type { Evidence, topics } from "../../evidence/contracts";
import { check } from "../checks";

type Topic = (typeof topics)[number];
export type EvidenceRequirement = {
  name: string;
  topic: Topic;
  passages: string[];
};

/** All parts must reach the same specialist in one quotation and its context. */
export function evidenceRequirement(
  name: string,
  topic: Topic,
  ...passages: string[]
): EvidenceRequirement {
  return { name, topic, passages };
}

export function checkEvidence(
  requirements: EvidenceRequirement[],
  evidence: Evidence[],
) {
  return requirements.map(({ name, topic, passages }) =>
    check(
      `evidence.${name}`,
      evidence.some(
        (item) =>
          item.topics.includes(topic) &&
          passages.every((passage) =>
            [item.quote, ...item.context.map((part) => part.quote)].some(
              (text) => text.includes(passage),
            ),
          ),
      ),
      `Keep ${name} with its conditions and ${topic} topic in one evidence item`,
    ),
  );
}

import type { Evidence, topics } from "../../evidence/contracts";
import { roleEvidenceTopics } from "../../roles/contracts";
import { check } from "../checks";

type Topic = (typeof topics)[number];
type Recipient = keyof typeof roleEvidenceTopics;
export type EvidenceRequirement = {
  name: string;
  recipient: Recipient;
  passages: string[];
};

/** All parts must reach the same specialist in one quotation and its context. */
export function evidenceRequirement(
  name: string,
  recipient: Recipient,
  ...passages: string[]
): EvidenceRequirement {
  return { name, recipient, passages };
}

export function checkEvidence(
  requirements: EvidenceRequirement[],
  evidence: Evidence[],
) {
  return requirements.map(({ name, recipient, passages }) => {
    const selectedTopics: readonly Topic[] = roleEvidenceTopics[recipient];
    return check(
      `evidence.${name}`,
      evidence.some(
        (item) =>
          item.topics.some((topic) => selectedTopics.includes(topic)) &&
          passages.every((passage) =>
            [item.quote, ...item.context.map((part) => part.quote)].some(
              (text) => text.includes(passage),
            ),
          ),
      ),
      `Keep ${name} with its conditions in one evidence item available to ${recipient}`,
    );
  });
}

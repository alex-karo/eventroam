import type { EvalSuite } from "../fixtures";
import { check, scenarioResult } from "../checks";
import { bindEvidence } from "../../evidence/contracts";
import type { Evidence, ReaderOutput } from "../../evidence/contracts";
import type { RoleExecution } from "../../roles/invoke";
import { checkEvidence } from "./checks";
import { szigetReader } from "./sziget";
import { roskildeReader } from "./roskilde";
import { dateConflictReader } from "./date-conflict";

const definitions = [szigetReader, roskildeReader, dateConflictReader];

export function readerCases(suite: EvalSuite) {
  return definitions.map((definition) => {
    const parent = suite.cases.find(
      (item) => item.id === definition.sourceCaseId,
    );
    const source = parent?.sources.find(
      (source) =>
        source.attemptedUrl === definition.sourceUrl ||
        source.finalUrl === definition.sourceUrl,
    );
    if (!parent?.initial || parent.location || source?.status !== "ok") {
      throw new Error(`Reader case needs a readable source: ${definition.id}`);
    }
    for (const requirement of definition.requirements) {
      for (const passage of requirement.passages) {
        if (!source.markdown.includes(passage)) {
          throw new Error(
            `Reader case needs a literal passage: ${definition.id}/${requirement.name}`,
          );
        }
      }
    }
    return {
      id: definition.id,
      suite: "regression" as const,
      origin: parent.origin,
      task: "Extract complete source evidence",
      input: parent.input,
      todayUtc: parent.todayUtc,
      provenance: parent.provenance ?? suite.provenance,
      reader: {
        sourceCaseId: parent.id,
        requestedName: parent.initial.event.canonicalName,
        source,
        requirements: definition.requirements,
      },
    };
  });
}
export type ReaderEvalCase = ReturnType<typeof readerCases>[number];

export function scoreReader(
  item: ReaderEvalCase,
  execution: RoleExecution<ReaderOutput>,
) {
  const source = item.reader.source;
  const output = execution.output;
  const bound = output
    ? bindEvidence("s1", source.markdown, output, source.finalUrl)
    : { evidence: [] as Evidence[], limitations: [] as string[] };
  const evidenceChecks = checkEvidence(
    item.reader.requirements,
    bound.evidence,
  );
  const accepted = bound.evidence.length;
  const supplied = output?.evidence.length ?? 0;
  const ranges = bound.evidence
    .flatMap((item) => [item.span, ...item.context.map((part) => part.span)])
    .sort((a, b) => a.start - b.start);
  let coveredCharacters = 0;
  let end = 0;
  for (const range of ranges) {
    coveredCharacters += Math.max(0, range.end - Math.max(end, range.start));
    end = Math.max(end, range.end);
  }
  return {
    reader: {
      execution,
      evidence: bound.evidence,
      limitations: bound.limitations,
      recall: {
        found: evidenceChecks.filter((check) => check.passed).length,
        expected: evidenceChecks.length,
      },
      binding: { accepted, supplied },
      sourceCharacters: source.markdown.length,
      coveredCharacters,
      extractedCharacters: bound.evidence.reduce(
        (sum, item) =>
          sum +
          item.quote.length +
          item.context.reduce((sum, part) => sum + part.quote.length, 0),
        0,
      ),
    },
    score: scenarioResult([
      check(
        "execution",
        execution.status === "success" && execution.errors.length === 0,
        "Reader must return a valid domain result",
      ),
      check(
        "literal-binding",
        supplied > 0 && accepted === supplied,
        "All returned quotations and context must bind to the source",
      ),
      ...evidenceChecks,
      check(
        "limitations",
        !!output && bound.limitations.length === 0,
        "This readable fixture has no extraction problems",
      ),
      check(
        "notPublished",
        !!output && output.coverage.notPublished.length === 0,
        "This fixture makes no explicit statement of nonpublication",
      ),
      check(
        "coverage",
        !!output && output.coverage.found.length > 0,
        "Return navigation coverage for the collected information",
      ),
    ]),
  };
}
export type ReaderEvalOutput = ReturnType<typeof scoreReader>["reader"];

import { bindSelectedEvidence } from "../evidence/contracts";
import { segmentPage } from "../evidence/segments";
import { readSource, type ReadSource } from "../roles/reader/agent";
import type { ReaderSelectionOutput } from "../roles/reader/contracts";
import type { PipelineEvalCase } from "./fixtures";

export function bindFixtureEvidence(
  caseId: string,
  sourceId: string,
  { markdown, finalUrl }: { markdown: string; finalUrl: string },
  output: ReaderSelectionOutput,
) {
  const { spans } = segmentPage(markdown);
  const { evidence } = bindSelectedEvidence(
    sourceId,
    markdown,
    output,
    finalUrl,
    spans,
  );
  if (evidence.length !== output.evidence.length) {
    throw new Error(
      `${caseId}: invalid fixed Reader selection for ${finalUrl}`,
    );
  }
  return evidence;
}

/** Replay fixed selections through the normal Reader path. */
export function fixedReader(item: PipelineEvalCase): ReadSource | undefined {
  const handoff = item.roleHandoff;
  if (!handoff && !item.sources.some((source) => source.readerOutput)) {
    return undefined;
  }
  return (options) => {
    const { source, page } = options.input;
    return readSource({
      ...options,
      generate: async () => {
        const recorded = handoff?.pages.find(
          ({ sourceId }) => sourceId === source.id,
        );
        const fixed = item.sources.find(({ attemptedUrl, finalUrl }) =>
          handoff
            ? attemptedUrl === recorded?.url
            : finalUrl === source.finalUrl,
        );
        const output = handoff ? recorded?.reader : fixed?.readerOutput;
        if (
          !output ||
          fixed?.markdown !== page ||
          fixed.finalUrl !== source.finalUrl
        ) {
          throw new Error(`${item.id}: unexpected fixed Reader input`);
        }
        return structuredClone(output);
      },
    });
  };
}

import { z } from "zod";
import { bindEvidence } from "../evidence/contracts";
import { invokeReader, type ReadSource } from "../roles/reader/agent";
import {
  contextualSelection,
  readerSelectionSchema,
  selectedEvidence,
} from "../roles/reader/contracts";
import type { PipelineEvalCase } from "./fixtures";

const quote = z.string().min(1).max(24000);
export const fixedReaderOutputSchema = readerSelectionSchema.extend({
  evidence: z
    .array(
      z.union([
        contextualSelection.extend({ quote, context: z.array(quote).max(24) }),
        selectedEvidence.extend({ quote }),
      ]),
    )
    .max(150),
});

/** Replay fixed quotations against the original Markdown to keep their exact spans. */
export function fixedReader(item: PipelineEvalCase): ReadSource | undefined {
  const handoff = item.roleHandoff;
  if (!handoff && !item.sources.some((source) => source.readerOutput)) {
    return undefined;
  }
  return (options) => {
    const { source, page } = options.input;
    return invokeReader(
      {
        ...options,
        schema: fixedReaderOutputSchema,
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
      },
      (output) => bindEvidence(source.id, page, output, source.finalUrl),
    );
  };
}

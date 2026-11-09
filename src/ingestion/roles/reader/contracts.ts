import { z } from "zod";
import { topics } from "../../evidence/contracts";

const segmentId = z.int().positive();
const segmentSelection = z.union([
  segmentId,
  z.strictObject({ start: segmentId, end: segmentId }),
]);
export const selectedEvidence = z.strictObject({
  quote: segmentSelection.describe(
    "One segment ID or an inclusive range of segment IDs in page order.",
  ),
  topics: z
    .array(z.enum(topics))
    .max(9)
    .describe(
      "Use at least one topic per quotation. Omit unrelated quotations.",
    ),
});
export const contextualSelection = selectedEvidence.extend({
  context: z
    .array(segmentSelection)
    .max(24)
    .describe(
      "Separate segment selections for any needed heading, year or condition outside the quote.",
    ),
  editionClues: z
    .array(
      z
        .string()
        .describe("Short literal scope hint, normally under 250 characters."),
    )
    .max(20),
  uncertainty: z
    .string()
    .describe("Briefly explain the ambiguity, normally under 1000 characters.")
    .nullable(),
});
const readerPageResult = z.strictObject({
  overview: z
    .string()
    .min(1)
    .describe(
      "Describe only this page in 1-2 sentences, normally under 300 characters. Do not compare it with the requested Event or infer identity conflicts.",
    ),
  coverage: z.strictObject({
    found: z
      .array(
        z
          .string()
          .min(1)
          .describe(
            "Short label of collected information, normally under 100 characters. In location labels, keep the explicit source country and say whether a festival venue/address was collected or only a town, country or office.",
          ),
      )
      .max(9),
    notPublished: z
      .array(
        z
          .string()
          .min(1)
          .describe(
            "Short explicit absence statement, normally under 100 characters.",
          ),
      )
      .max(6)
      .describe(
        'Return [] when there is no statement, never [""], [" "] or ["None"]. Include only what the page author explicitly says is unavailable or not announced. Never include your observation that a fact is not stated. For example, a ticket page without an attendance count still needs [].',
      ),
  }),
  topics: z.array(z.enum(topics)).max(9),
  statedYears: z
    .array(
      z
        .string()
        .describe(
          "Short literal year or date label, normally under 80 characters.",
        ),
    )
    .max(100),
  limitations: z
    .array(
      z
        .string()
        .describe(
          "Briefly name the extraction problem, normally under 500 characters.",
        ),
    )
    .max(30)
    .describe(
      "Actual extraction problems only, such as cut or unreadable source content. Return [] for absent optional facts, unmentioned topics or explicit nonpublication.",
    ),
});

export const readerSelectionSchema = readerPageResult.extend({
  // Keep full metadata first so native schema handling retains required null values.
  evidence: z.array(z.union([contextualSelection, selectedEvidence])).max(150),
});
export type ReaderSelectionOutput = z.infer<typeof readerSelectionSchema>;
export type ReaderEvidence = z.infer<typeof contextualSelection>;

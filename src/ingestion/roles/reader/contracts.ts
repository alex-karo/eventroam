import { z } from "zod";
import { topics } from "../../evidence/contracts";

const quote = z.string().min(1).max(24000);
const readerEvidence = z.strictObject({
  quote: z
    .union([
      quote,
      z.strictObject({
        start: z
          .string()
          .min(1)
          .describe(
            "Exact unique opening text, normally at most 250 characters. Preserve whitespace.",
          ),
        end: z
          .string()
          .min(1)
          .describe(
            "Exact unique closing text, normally at most 250 characters. It must follow the opening text. Never use a repeated bullet.",
          ),
      }),
    ])
    .describe(
      "Copy the full literal quotation when it has at most 2000 characters. Use start/end only for longer passages, with both boundaries unique in the complete page.",
    ),
  topics: z
    .array(z.enum(topics))
    .max(9)
    .describe(
      "Use at least one topic per quotation. Omit unrelated quotations.",
    ),
});
const contextualReaderEvidence = readerEvidence.extend({
  context: z
    .array(quote)
    .max(24)
    .describe(
      "Return [] unless a separate source passage supplies missing year, object or qualification. Copy each context exactly, including its original heading markers. Do not attach a generic page heading to an already complete quotation or reconstruct a section title.",
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

// Recorded and injected replies keep the literal format used when they were captured.
export const readerOutputSchema = readerPageResult.extend({
  evidence: z
    .array(z.union([contextualReaderEvidence, readerEvidence]))
    .max(150),
});
export type ReaderOutput = z.infer<typeof readerOutputSchema>;
export type ReaderEvidence = z.infer<typeof contextualReaderEvidence>;

const segmentId = z.int().positive();
const segmentSelection = z.union([
  segmentId,
  z.strictObject({ start: segmentId, end: segmentId }),
]);
const selectedEvidence = readerEvidence.extend({
  quote: segmentSelection.describe(
    "One segment ID or an inclusive range of segment IDs in page order.",
  ),
});
const contextualSelection = contextualReaderEvidence.extend({
  quote: selectedEvidence.shape.quote,
  context: z
    .array(segmentSelection)
    .max(24)
    .describe(
      "Separate segment selections for any needed heading, year or condition outside the quote.",
    ),
});
export const readerSelectionSchema = readerPageResult.extend({
  // Keep full metadata first so native schema handling retains required null values.
  evidence: z.array(z.union([contextualSelection, selectedEvidence])).max(150),
});
export type ReaderSelectionOutput = z.infer<typeof readerSelectionSchema>;

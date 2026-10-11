import { z } from "zod";
import { sourceUrlSchema, remainingSchema } from "../contracts";

export const searchQuerySchema = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .describe(
    "A specific festival or edition question, 3–300 characters after trimming.",
  );

export const discoverSourcesInputSchema = z.object({
  query: searchQuerySchema,
});

const count = z.number().int().nonnegative();
const cost = z.number().nonnegative();

export const discoverSourcesOutputSchema = z.object({
  query: searchQuerySchema,
  candidates: z.array(z.object({ url: sourceUrlSchema, title: z.string() })),
  retrievedAt: z.iso.datetime(),
  inputTokens: count,
  outputTokens: count,
  cachedInputTokens: count.nullable().optional(),
  reasoningTokens: count.nullable().optional(),
  modelCostUsd: cost.nullable(),
  searchCostUsd: cost,
  usageComplete: z.boolean().optional(),
  remaining: remainingSchema,
});

export interface SourceCandidate {
  url: string;
  title: string;
}

export interface DiscoverSourcesResult {
  query: string;
  candidates: SourceCandidate[];
  retrievedAt: string;
  modelCostUsd: number | null;
  searchCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** False when attempts or provider token counts are unaccounted for. */
  usageComplete?: boolean;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
}

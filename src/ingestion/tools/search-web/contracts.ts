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

export const searchWebInputSchema = z.object({
  query: searchQuerySchema,
});

const count = z.number().int().nonnegative();
const cost = z.number().nonnegative();

export const searchWebOutputSchema = z.object({
  query: searchQuerySchema,
  candidates: z.array(
    z.object({
      url: sourceUrlSchema,
      title: z.string(),
      highlights: z.array(z.string().min(1).max(2000)).max(1),
    }),
  ),
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
  highlights: string[];
}

export interface SearchWebResult {
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

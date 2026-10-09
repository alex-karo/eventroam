import { z } from "zod";

export const searchQuerySchema = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .describe(
    "A specific festival or edition question, 3–300 characters after trimming.",
  );

const sourceUrlSchema = z
  .url({ protocol: /^https?$/ })
  .regex(/^https?:\/\//)
  .describe(
    "An absolute HTTP/HTTPS URL of a public page, without credentials. Private addresses and unsafe redirects are blocked.",
  );

export const readSourceInputSchema = z.object({ url: sourceUrlSchema });
export const discoverSourcesInputSchema = z.object({
  query: searchQuerySchema,
});

const count = z.number().int().nonnegative();
const cost = z.number().nonnegative();
const remainingSchema = z.object({
  searches: count,
  pages: count,
  modelCalls: count,
  durationMs: count,
});

export const readSourceOutputSchema = z.object({
  attemptedUrl: sourceUrlSchema,
  finalUrl: sourceUrlSchema,
  retrievedAt: z.iso.datetime(),
  outcome: z.enum(["ok", "partial", "unsupported", "blocked", "failed"]),
  reason: z.string().optional(),
  markdown: z.string(),
  truncated: z.boolean(),
  completeness: z.enum(["full", "partial", "none"]),
  remaining: remainingSchema,
});

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

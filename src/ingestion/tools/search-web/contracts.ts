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
}

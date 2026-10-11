import { z } from "zod";
import { sourceUrlSchema, remainingSchema } from "../contracts";

export const readSourceInputSchema = z.object({ url: sourceUrlSchema });

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

export type RetrievalOutcome =
  "ok" | "partial" | "unsupported" | "blocked" | "failed";

export interface ReadSourceResult {
  attemptedUrl: string;
  finalUrl: string;
  retrievedAt: string;
  method: "http" | "firecrawl" | "social_stub";
  outcome: RetrievalOutcome;
  reason?: string;
  /** Host-only extractor observation; never part of model tool output. */
  sourceTruncated?: boolean;
  /** Host-only retrieval diagnostic, excluded from model tool output. */
  httpStatus?: number;
  /** Ordered Markdown extracted from the fetched page. */
  markdown: string;
  links: string[];
  /** Whether the fetched source was sufficiently readable to support absence claims. */
  completeness: "full" | "partial" | "none";
}

import { z } from "zod";
import { sourceUrlSchema, remainingSchema } from "../contracts";

export const readPageInputSchema = z.object({ url: sourceUrlSchema });

export const readPageOutputSchema = z.object({
  url: sourceUrlSchema,
  status: z.enum(["ok", "unsupported", "failed"]),
  reasonCode: z.string().optional(),
  markdown: z.string(),
  truncated: z.boolean(),
  remaining: remainingSchema,
});

export type ReadPageStatus = "ok" | "unsupported" | "failed";

export interface ReadPageResult {
  attemptedUrl: string;
  finalUrl: string;
  retrievedAt: string;
  method: "http" | "firecrawl" | "social_stub";
  status: ReadPageStatus;
  reasonCode?: string;
  /** Host-only retrieval diagnostic, excluded from model tool output. */
  httpStatus?: number;
  /** Ordered Markdown extracted from the fetched page. */
  markdown: string;
}

/** Inspectable retrieval metadata; page text stays in the source session. */
export type SourceReadMetadata = Omit<ReadPageResult, "markdown">;

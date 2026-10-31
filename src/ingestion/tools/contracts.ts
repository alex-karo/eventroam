import { z } from "zod";
import type { ResearchBudget } from "../runtime/budget";
import type { RunObservability } from "../runtime/observability/runtime";
import type { SourceSession } from "./session";

export type ResearchToolContext = {
  sources: SourceSession;
  budget: ResearchBudget;
  modelContext: () => { stage: string; step: number; attempt: number };
  tracing?: RunObservability;
  abortSignal?: AbortSignal;
};

export const sourceUrlSchema = z
  .url({ protocol: /^https?$/ })
  .regex(/^https?:\/\//)
  .describe(
    "An absolute HTTP/HTTPS URL of a public page, without credentials. Private addresses and unsafe redirects are blocked.",
  );

export const remainingSchema = z.object({
  searches: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export type KnownSourceLink = {
  url: string;
  owner: "event" | "edition";
  kind: string;
  official: boolean;
  editionKey?: string;
};

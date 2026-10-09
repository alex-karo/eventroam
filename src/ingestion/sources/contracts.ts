export type RetrievalOutcome =
  "ok" | "partial" | "unsupported" | "blocked" | "failed";

export interface ReadSourceResult {
  attemptedUrl: string;
  finalUrl: string;
  retrievedAt: string;
  method: "http" | "firecrawl" | "social_stub";
  outcome: RetrievalOutcome;
  reason?: string;
  /** Ordered Markdown extracted from the fetched page. */
  markdown: string;
  links: string[];
  /** Whether the fetched source was sufficiently readable to support absence claims. */
  completeness: "full" | "partial" | "none";
}

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
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
}

export type KnownSourceLink = {
  url: string;
  owner: "event" | "occurrence";
  kind: string;
  official: boolean;
  editionKey?: string;
};

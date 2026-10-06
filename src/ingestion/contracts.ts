import type Database from "better-sqlite3";
import type { CatalogOperation } from "@/catalog/operations/operation";
import type { ResearchBudget, ResearchLimits } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { readSource } from "./sources/read-source";
import type { discoverSources } from "./sources/discover-sources";
import type {
  ReadSourceResult,
  DiscoverSourcesResult,
} from "./sources/contracts";
import type { ResearchGap } from "./research/contracts";

export type CatalogResearchInput = {
  mode: "add" | "refresh" | "check";
  name?: string;
  eventId?: string;
  actor: string;
  initiatedBy?: string;
  dryRun?: boolean;
  republish?: boolean;
  limits?: Partial<ResearchLimits>;
};

export type CatalogResearchResult = {
  mode: CatalogResearchInput["mode"];
  outcome:
    "created" | "updated" | "published" | "unchanged" | "skipped" | "failed";
  eventId?: string;
  /** Final model output before normalization; absent in older reports. */
  modelResponse?: { text: string | null; object: unknown } | null;
  operations: CatalogOperation[];
  receipts: { id: string; version: number; changed: boolean }[];
  references: Record<string, string>;
  changes: {
    subject: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  sources: {
    attemptedUrl: string;
    finalUrl: string;
    retrievedAt: string;
    outcome: ReadSourceResult["outcome"];
    reason?: string;
  }[];
  gaps: ResearchGap[];
  usage: ReturnType<ResearchBudget["snapshot"]> & {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number | null;
    reasoningTokens?: number | null;
    modelCostUsd: number | null;
    searchCostUsd: number;
  };
  modelVersion: string;
  reasoningEffort?: ResearchConfig["reasoningEffort"] | null;
  promptVersion: string;
  durationMs: number;
};

export type ResearchDependencies = {
  client: Database.Database;
  config?: ResearchConfig;
  /** Freeze the domain date in reproducible evaluations. */
  todayUtc?: string;
  readSource?: typeof readSource;
  discoverSources?: typeof discoverSources;
  /** Fixture provider receives the same bounded prompt as the real Mastra agent. */
  generateCandidate?: (
    prompt: string,
    context: {
      budget: ResearchBudget;
      reads: ReadSourceResult[];
      readSource: (url: string) => Promise<ReadSourceResult>;
      discoverSources: (query: string) => Promise<DiscoverSourcesResult>;
    },
  ) => Promise<unknown>;
};

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
import type {
  ResearchError,
  ResearchQuestion,
  ResearchStatus,
  ResearchCandidate,
} from "./research/contracts";

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
  schemaVersion: 2;
  /** Absent only in historical version 2 reports. */
  runId?: string;
  mode: CatalogResearchInput["mode"];
  outcome:
    "created" | "updated" | "published" | "unchanged" | "skipped" | "failed";
  eventId?: string;
  researchStatus: ResearchStatus;
  /** Final model output before normalization. */
  modelResponse: { text: string | null; object: unknown } | null;
  assembledCandidate?: ResearchCandidate | null;
  ticketResearch?: Pick<
    import("./research/ticket-agent").TicketExecution,
    "outcome" | "raw" | "usage"
  >;
  operations: CatalogOperation[];
  receipts: { id: string; version: number; changed: boolean }[];
  references: Record<string, string>;
  changes: {
    subject: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    explanations: string[];
  }[];
  sources: {
    attemptedUrl: string;
    finalUrl: string;
    retrievedAt: string;
    outcome: ReadSourceResult["outcome"];
    reason?: string;
  }[];
  sourceSummaries: { url: string; information: string }[];
  errors: ResearchError[];
  unresolved: ResearchQuestion[];
  eventNameMismatch: {
    eventId: string;
    storedName: string;
    observedName: string;
  } | null;
  usage: ReturnType<ResearchBudget["snapshot"]> & {
    /** False means reported tokens are only the known portion of the run. */
    complete: boolean;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number | null;
    reasoningTokens?: number | null;
    modelCostUsd: number | null;
    searchCostUsd: number;
    searchCostBasis?: "estimate";
  };
  modelVersion: string;
  reasoningEffort?: Exclude<
    ResearchConfig["reasoningEffort"],
    undefined
  > | null;
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
  generateTickets?: (
    prompt: string,
    context: {
      budget: ResearchBudget;
      handoff: import("./research/ticket-handoff").TicketHandoff;
      signal: AbortSignal;
      onStepFinish: (
        step: Parameters<
          typeof import("./research/execution").updateModelUsage
        >[1],
      ) => void;
    },
  ) => Promise<unknown>;
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

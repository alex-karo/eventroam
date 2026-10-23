import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { ResearchContext } from "./research/context";
import type { ResearchExecution } from "./research/agent";
import type { prepareEditorPlan } from "./editor/prepare";
import { emptyEditorExecution, type EditorExecution } from "./editor/agent";
import type Database from "better-sqlite3";
import type { DuckDBStore } from "@mastra/duckdb";
import type { CatalogOperation } from "@/catalog/operations/operation";
import type { ResearchBudget, ResearchLimits } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { readPage } from "./tools/read-page/read";
import type { searchWeb } from "./tools/search-web/search";
import type {
  ReadPageResult,
  SourceReadMetadata,
} from "./tools/read-page/contracts";
import type { SearchWebResult } from "./tools/search-web/contracts";
import type {
  ResearchError,
  ResearchQuestion,
  ResearchStatus,
} from "./research/contracts";

export type CatalogResearchInput = {
  mode: "add" | "refresh";
  scope?: "full" | "current";
  name?: string;
  eventId?: string;
  actor: string;
  initiatedBy?: string;
  dryRun?: boolean;
  republish?: boolean;
  limits?: Partial<ResearchLimits>;
};

export type CatalogResearchResult = {
  schemaVersion: 6;
  scope: NonNullable<CatalogResearchInput["scope"]> | null;
  currentDate: string | null;
  limits: ResearchLimits;
  workload: {
    savedEditions: number;
    returnedEditions: number;
  };
  /** Assigned by the host when an ingestion attempt starts. */
  runId?: string;
  mode: CatalogResearchInput["mode"];
  outcome:
    "created" | "updated" | "published" | "unchanged" | "skipped" | "failed";
  eventId?: string;
  researchStatus: ResearchStatus;
  /** Final model output before normalization. */
  modelResponse: { text: string | null; object: unknown } | null;
  editorResponse: { text: string | null; object: unknown } | null;
  editorStatus: EditorExecution["status"];
  editorPromptVersion: string;
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
    outcome: ReadPageResult["outcome"];
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
    /** Sum of reported model costs; may be partial. Null when none are known. */
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
  /** Shared local Studio observability store; the caller owns its lifetime. */
  observabilityStore?: DuckDBStore;
  config?: ResearchConfig;
  /** Protect the selected optional report destination from observability writes. */
  reportPath?: string;
  /** Freeze the domain date in reproducible evaluations. */
  todayUtc?: string;
  generateEditor?: (
    prompt: string,
    context: { budget: ResearchBudget; abortSignal: AbortSignal },
  ) => Promise<unknown>;
  readPage?: typeof readPage;
  searchWeb?: typeof searchWeb;
  /** Fixture provider receives the same bounded prompt as the real Mastra agent. */
  generateCandidate?: (
    prompt: string,
    context: {
      budget: ResearchBudget;
      reads: ReadPageResult[];
      readPage: (url: string) => Promise<ReadPageResult>;
      searchWeb: (query: string) => Promise<SearchWebResult>;
    },
  ) => Promise<unknown>;
};
/** Serializable research accumulated by native Mastra workflow state. */
export type IngestionData = {
  context: ResearchContext | null;
  reads: SourceReadMetadata[];
  discovery: SearchWebResult[];
  research: ResearchExecution;
  editor: EditorExecution;
  prepared: ReturnType<typeof prepareEditorPlan> | null;
  applied: ReturnType<typeof applyCatalogItem> | null;
  writeFailed: boolean;
  errors: ResearchError[];
  unresolved: ResearchQuestion[];
  report: CatalogResearchResult | null;
};

export function createIngestionData(): IngestionData {
  return {
    context: null,
    reads: [],
    discovery: [],
    research: {
      ok: false,
      errors: [],
      usage: {
        complete: false,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: null,
        reasoningTokens: null,
        modelCostUsd: null,
      },
    },
    editor: emptyEditorExecution(),
    prepared: null,
    applied: null,
    writeFailed: false,
    errors: [],
    unresolved: [],
    report: null,
  };
}

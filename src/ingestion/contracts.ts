import type { Targets, CollectionOutput } from "./roles/contracts";
import type { PlanDiagnostics } from "./stage";
import type { RoleExecution } from "./roles/invoke";
import type { FrozenCorpus } from "./evidence/contracts";
import type { PreparedProposals, AcceptedProposals } from "./proposals";
import type { ReadyCatalogPlan } from "./catalog-plan";
import type { StageResult } from "./stage";
import {
  emptyLocationExecution,
  type LocationExecution,
  type GenerateLocation,
} from "./location/agent";
import type { GeocodingClient } from "./tools/geocode/contracts";
import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { ResearchContext } from "./research/context";
import {
  emptyEditorExecution,
  type EditorExecution,
} from "./roles/editor-execution";
import type Database from "better-sqlite3";
import type { DuckDBStore } from "@mastra/duckdb";
import type { WorkflowStorage } from "./runtime/workflow-storage";
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
  schemaVersion: 7;
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
    outcome: ReadPageResult["status"];
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
  budget: ReturnType<ResearchBudget["snapshot"]>;
  locationResponse: LocationExecution["modelResponse"];
  locationStatus: LocationExecution["status"];
  locationPromptVersion: string;
  locationModelVersion: string;
  geocoding: {
    observations: LocationExecution["observations"];
    points: LocationExecution["points"];
  };
  traceId?: string;
  modelVersion: string;
  reasoningEffort?: Exclude<
    ResearchConfig["reasoningEffort"],
    undefined
  > | null;
  promptVersion: string;
  durationMs: number;
};

export type ResearchDependencies = {
  generateRole?: import("./roles/invoke").GenerateRole;
  generateRoles?: Partial<
    Record<import("./roles/invoke").Role, import("./roles/invoke").GenerateRole>
  >;
  client: Database.Database;
  /** Shared local Studio observability store; the caller owns its lifetime. */
  observabilityStore?: DuckDBStore;
  /** Injected workflow storage is owned by the caller. */
  workflowStorage?: WorkflowStorage;
  workflowDatabasePath?: string;
  /** Link native observations to the eval experiment. */
  experimentId?: string;
  config?: ResearchConfig;
  /** Protect the selected optional report destination from observability writes. */
  reportPath?: string;
  /** Freeze the domain date in reproducible evaluations. */
  todayUtc?: string;
  generateLocation?: GenerateLocation;
  geocodingClient?: GeocodingClient;
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
  research: RoleExecution<CollectionOutput>;
  general: RoleExecution<import("./roles/contracts").GeneralOutput>;
  specialists: Record<string, RoleExecution>;
  corpus: FrozenCorpus | null;
  prepared: StageResult<PreparedProposals> | null;
  editor: EditorExecution;
  location: LocationExecution;
  researchValidation: StageResult<Targets & PlanDiagnostics> | null;
  editorValidation: StageResult<AcceptedProposals> | null;
  catalogPreparation: StageResult<ReadyCatalogPlan> | null;
  outcome: CatalogResearchResult["outcome"] | null;
  applied: ReturnType<typeof applyCatalogItem> | null;
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
      status: "not_run",
      errors: [],
      modelResponse: null,
      model: "",
      promptVersion: "",
      durationMs: 0,
    },
    general: {
      status: "not_run",
      errors: [],
      modelResponse: null,
      model: "",
      promptVersion: "",
      durationMs: 0,
    },
    specialists: {},
    corpus: null,
    prepared: null,
    editor: emptyEditorExecution(),
    location: emptyLocationExecution(),
    researchValidation: null,
    editorValidation: null,
    catalogPreparation: null,
    outcome: null,
    applied: null,
    errors: [],
    unresolved: [],
    report: null,
  };
}

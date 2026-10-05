import { DEFAULT_RESEARCH_LIMITS, type ResearchLimits } from "./budget";

export interface ResearchConfig {
  apiKey: string;
  model: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  serviceTier?: "flex";
  limits: ResearchLimits;
}

export const DEFAULT_RESEARCH_MODEL = "openai/gpt-6-luna";

const ENV_LIMITS: Record<keyof ResearchLimits, string> = {
  searches: "CATALOG_MAX_SEARCHES",
  pages: "CATALOG_MAX_PAGES",
  depth: "CATALOG_MAX_DEPTH",
  modelCalls: "CATALOG_MAX_MODEL_CALLS",
  durationMs: "CATALOG_MAX_DURATION_MS",
  pageBytes: "CATALOG_MAX_PAGE_BYTES",
  modelInputChars: "CATALOG_MAX_MODEL_INPUT_CHARS",
  modelOutputTokens: "CATALOG_MAX_MODEL_OUTPUT_TOKENS",
  searchResults: "CATALOG_MAX_SEARCH_RESULTS",
};

export function loadResearchConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResearchConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_RESEARCH_MODEL;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for research");
  if (model.endsWith(":online")) {
    throw new Error("OPENROUTER_MODEL must not enable automatic web search");
  }

  const effort = env.OPENROUTER_REASONING_EFFORT?.trim() || "medium";
  if (
    effort &&
    !["none", "minimal", "low", "medium", "high", "xhigh"].includes(effort)
  ) {
    throw new Error("OPENROUTER_REASONING_EFFORT is invalid");
  }
  const reasoningEffort = effort as ResearchConfig["reasoningEffort"];
  const serviceTier = env.OPENROUTER_SERVICE_TIER?.trim() || undefined;
  if (serviceTier !== undefined && serviceTier !== "flex") {
    throw new Error("OPENROUTER_SERVICE_TIER must be flex or empty");
  }

  const limits = { ...DEFAULT_RESEARCH_LIMITS };
  for (const [key, envName] of Object.entries(ENV_LIMITS) as [
    keyof ResearchLimits,
    string,
  ][]) {
    const raw = env[envName];
    if (raw === undefined || raw === "") continue;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error(`${envName} must be a non-negative integer`);
    }
    limits[key] = parsed;
  }

  return { apiKey, model, reasoningEffort, serviceTier, limits };
}

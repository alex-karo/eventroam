export type ResearchLimit = "time" | "searches" | "depth" | "modelInputChars";

export interface ResearchLimits {
  searches: number;
  depth: number;
  agentSteps: number;
  durationMs: number;
  pageBytes: number;
  modelInputChars: number;
  modelOutputTokens: number;
  searchResults: number;
}

export const DEFAULT_RESEARCH_LIMITS: ResearchLimits = {
  searches: 3,
  depth: 2,
  agentSteps: 10,
  durationMs: 5 * 60_000,
  pageBytes: 2 * 1024 * 1024,
  modelInputChars: 120_000,
  modelOutputTokens: 16_000,
  searchResults: 5,
};

export class ResearchLimitError extends Error {
  constructor(public readonly limit: ResearchLimit) {
    super(`Research ${limit} limit exhausted`);
    this.name = "ResearchLimitError";
  }
}

export interface ResearchBudgetSnapshot {
  searches: number;
  pages: number;
  modelCalls: number;
  elapsedMs: number;
  remaining: {
    searches: number;
    durationMs: number;
  };
}

export interface ResearchBudget {
  readonly limits: ResearchLimits;
  readonly deadline: number;
  assertTime(): void;
  consumeSearch(): void;
  consumePage(depth?: number): void;
  consumeModelCall(inputChars?: number): void;
  remaining(): ResearchBudgetSnapshot["remaining"];
  snapshot(): ResearchBudgetSnapshot;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid research limit: ${name}`);
  }
}

export function createResearchBudget(
  overrides: Partial<ResearchLimits> = {},
  now: () => number = Date.now,
): ResearchBudget {
  const limits = { ...DEFAULT_RESEARCH_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    assertPositiveInteger(name, value);
  }

  const startedAt = now();
  const deadline = startedAt + limits.durationMs;
  let searches = 0;
  let pages = 0;
  let modelCalls = 0;

  function assertTime(): void {
    if (now() >= deadline) {
      throw new ResearchLimitError("time");
    }
  }

  function consumeSearch(): void {
    assertTime();
    if (searches >= limits.searches) {
      throw new ResearchLimitError("searches");
    }
    searches += 1;
  }

  const remaining = () => ({
    searches: limits.searches - searches,
    durationMs: Math.max(0, deadline - now()),
  });

  return {
    limits,
    deadline,
    assertTime,
    consumeSearch,
    consumePage: (depth = 0) => {
      if (!Number.isSafeInteger(depth) || depth < 0 || depth > limits.depth) {
        throw new ResearchLimitError("depth");
      }
      assertTime();
      pages += 1;
    },
    consumeModelCall: (inputChars = 0) => {
      if (
        !Number.isSafeInteger(inputChars) ||
        inputChars > limits.modelInputChars
      ) {
        throw new ResearchLimitError("modelInputChars");
      }
      assertTime();
      modelCalls += 1;
    },
    remaining,
    snapshot: () => ({
      searches,
      pages,
      modelCalls,
      elapsedMs: Math.max(0, now() - startedAt),
      remaining: remaining(),
    }),
  };
}

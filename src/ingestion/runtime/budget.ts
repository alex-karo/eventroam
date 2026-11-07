export type ResearchLimit = "time" | "searches" | "context" | "steps";

export interface ResearchLimits {
  searches: number;
  agentSteps: number;
  durationMs: number;
  pageBytes: number;
  modelOutputTokens: number;
  searchResults: number;
}

export const DEFAULT_RESEARCH_LIMITS: ResearchLimits = {
  searches: 3,
  agentSteps: 15,
  durationMs: 10 * 60_000,
  pageBytes: 2 * 1024 * 1024,
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
  consumePage(): void;
  consumeModelCall(): void;
  remaining(): ResearchBudgetSnapshot["remaining"];
  snapshot(): ResearchBudgetSnapshot;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid research limit: ${name}`);
  }
}

export function createResearchBudgetState(
  overrides: Partial<ResearchLimits> = {},
  now: () => number = Date.now,
) {
  const limits = { ...DEFAULT_RESEARCH_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    assertPositiveInteger(name, value);
  }

  return { limits, startedAt: now(), searches: 0, pages: 0, modelCalls: 0 };
}

export type ResearchBudgetState = ReturnType<typeof createResearchBudgetState>;

export function createResearchBudget(
  overrides: Partial<ResearchLimits> = {},
  now: () => number = Date.now,
): ResearchBudget {
  return researchBudgetFromState(
    createResearchBudgetState(overrides, now),
    now,
  );
}

export function researchBudgetFromState(
  state: ResearchBudgetState,
  now: () => number = Date.now,
): ResearchBudget {
  const { limits, startedAt } = state;
  const deadline = startedAt + limits.durationMs;

  function assertTime(): void {
    if (now() >= deadline) {
      throw new ResearchLimitError("time");
    }
  }

  function consumeSearch(): void {
    assertTime();
    if (state.searches >= limits.searches) {
      throw new ResearchLimitError("searches");
    }
    state.searches += 1;
  }

  const remaining = () => ({
    searches: limits.searches - state.searches,
    durationMs: Math.max(0, deadline - now()),
  });

  return {
    limits,
    deadline,
    assertTime,
    consumeSearch,
    consumePage: () => {
      assertTime();
      state.pages += 1;
    },
    consumeModelCall: () => {
      assertTime();
      state.modelCalls += 1;
    },
    remaining,
    snapshot: () => ({
      searches: state.searches,
      pages: state.pages,
      modelCalls: state.modelCalls,
      elapsedMs: Math.max(0, now() - startedAt),
      remaining: remaining(),
    }),
  };
}

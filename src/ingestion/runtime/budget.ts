export type ResearchLimit =
  "time" | "searches" | "pages" | "depth" | "modelCalls" | "modelInputChars";

export interface ResearchLimits {
  searches: number;
  pages: number;
  depth: number;
  modelCalls: number;
  durationMs: number;
  pageBytes: number;
  modelInputChars: number;
  modelOutputTokens: number;
  searchResults: number;
}

export const DEFAULT_RESEARCH_LIMITS: ResearchLimits = {
  searches: 3,
  pages: 20,
  depth: 2,
  modelCalls: 10,
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
    pages: number;
    modelCalls: number;
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
  refundModelCall(): void;
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

  function consume(kind: "searches" | "pages" | "modelCalls"): void {
    assertTime();
    const used = { searches, pages, modelCalls }[kind];
    if (used >= limits[kind]) {
      throw new ResearchLimitError(kind);
    }
    switch (kind) {
      case "searches":
        searches += 1;
        break;
      case "pages":
        pages += 1;
        break;
      case "modelCalls":
        modelCalls += 1;
        break;
    }
  }

  const remaining = () => ({
    searches: limits.searches - searches,
    pages: limits.pages - pages,
    modelCalls: limits.modelCalls - modelCalls,
    durationMs: Math.max(0, deadline - now()),
  });

  return {
    limits,
    deadline,
    assertTime,
    consumeSearch: () => consume("searches"),
    consumePage: (depth = 0) => {
      if (!Number.isSafeInteger(depth) || depth < 0 || depth > limits.depth) {
        throw new ResearchLimitError("depth");
      }
      consume("pages");
    },
    consumeModelCall: (inputChars = 0) => {
      if (
        !Number.isSafeInteger(inputChars) ||
        inputChars > limits.modelInputChars
      ) {
        throw new ResearchLimitError("modelInputChars");
      }
      consume("modelCalls");
    },
    refundModelCall: () => {
      modelCalls = Math.max(0, modelCalls - 1);
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

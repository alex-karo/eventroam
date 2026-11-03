import { expect, test, vi } from "vitest";
import { logPreparation } from "./workflow-logging";
import { initialDiagnostics } from "./proposals";
import type { Targets } from "./roles/contracts";

function targets(): Targets {
  return {
    decision: "targets",
    eventId: null,
    observedEventName: "Example Fest",
    reason: "Inspected identity",
    evidenceIds: ["s1-e1"],
    event: {},
    previousEdition: {
      editionKey: "2026",
      reason: "Completed Edition",
      evidenceIds: ["s1-e1"],
      fields: {},
    },
    currentOrNextEdition: null,
    checks: [],
    unresolved: [],
  };
}

const knownContext = {
  stage: "validation",
  status: "targets",
  eventName: "Example Fest",
  editions: [{ role: "previousEdition", editionKey: "2026", year: null }],
  operationCount: 0,
};

test("a valid creation skip logs at info level with its research context", () => {
  const result = {
    status: "skip" as const,
    diagnostics: {
      ...initialDiagnostics(),
      unresolved: [{ field: "identity", message: "Identity is not confirmed" }],
    },
  };
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logPreparation(log, result, targets());
  expect(log.warn).not.toHaveBeenCalled();
  expect(log.info).toHaveBeenCalledExactlyOnceWith(
    "Editorial plan skipped",
    expect.objectContaining({
      ...knownContext,
      unresolved: ["Identity is not confirmed"],
    }),
  );
});

test("a rejected editor plan keeps successful research context in its warning", () => {
  const result = {
    status: "reject" as const,
    diagnostics: {
      ...initialDiagnostics(),
      errors: [
        {
          code: "invalid_plan" as const,
          stage: "validation" as const,
          message: "Invalid decision keys",
        },
      ],
    },
  };
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logPreparation(log, result, targets());
  expect(log.info).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledExactlyOnceWith(
    "Editorial plan rejected",
    expect.objectContaining({
      ...knownContext,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "invalid_plan" }),
      ]),
    }),
  );
});

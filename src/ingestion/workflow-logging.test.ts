import { validateResearch } from "./research/validate";
import { expect, test, vi } from "vitest";
import { logPreparation } from "./workflow-logging";
import { prepareEditorPlan } from "./editor/prepare";
import type { CatalogResearchInput } from "./contracts";

const input: CatalogResearchInput = {
  mode: "add",
  name: "Example Fest",
  actor: "catalog-research",
};

function checkedResearch() {
  const result = validateResearch(
    {
      status: "success",
      errors: [],
      unresolved: [],
      data: {
        eventName: "Example Fest",
        sources: [],
        links: { socials: {} },
        previousEdition: { key: "2026", links: {} },
        currentOrNextEdition: null,
      },
    },
    [],
    input,
  );
  if (result.status !== "continue") {
    throw new Error("Expected valid research");
  }
  return result.value;
}

const knownContext = {
  stage: "validation",
  status: "success",
  eventName: "Example Fest",
  editions: [{ role: "previousEdition", editionKey: "2026", year: null }],
  operationCount: 0,
};

test("a valid creation skip logs at info level with its research context", () => {
  const checked = checkedResearch();
  const result = prepareEditorPlan(
    {
      status: "ready",
      event: null,
      previousEdition: null,
      currentOrNextEdition: null,
      unresolved: [{ field: "identity", message: "Identity is not confirmed" }],
    },
    checked,
    [],
    input,
    [],
  );
  expect(result.status).toBe("skip");
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logPreparation(log, result, checked.candidate);
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
  const checked = checkedResearch();
  const result = prepareEditorPlan({}, checked, [], input, []);
  expect(result.status).toBe("reject");
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logPreparation(log, result, checked.candidate);
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

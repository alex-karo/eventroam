import { Mastra } from "@mastra/core/mastra";
import { z } from "zod";
import { createWorkflowStorage } from "@/ingestion/runtime/workflow-storage";
import { trackFixtureWorkflowStore } from "./workflow-stores";
import { reviewSchema } from "@/ingestion/proposals";
import { locationTextFields } from "@/ingestion/location/contracts";
import type { LocationInput } from "@/ingestion/location/input";
import type {
  LocationFields,
  LocationOutput,
} from "@/ingestion/location/contracts";
import type { StageResult } from "@/ingestion/stage";
import type { ResearchDependencies } from "@/ingestion/contracts";
import type { GenerateRole, Role } from "@/ingestion/roles/invoke";
import type { Targets, CheckFinding } from "@/ingestion/roles/contracts";
import { topics } from "@/ingestion/evidence/contracts";
import {
  runCatalogResearch,
  createCatalogIngestionWorkflow,
} from "@/ingestion/workflow";

export const fixtureUrl = "https://example.org/";
export const fixtureReason = "The official source states this fact.";
export const fixtureEvidence = ["s1-e1"];
export function set<T>(
  value: T,
  reason = fixtureReason,
  evidenceIds = fixtureEvidence,
) {
  return { action: "set" as const, value, reason, evidenceIds };
}
export function clear(reason = fixtureReason, evidenceIds = fixtureEvidence) {
  return { action: "clear" as const, reason, evidenceIds };
}
export function fixtureTargets(eventId: string | null = null): Targets {
  return {
    decision: "targets",
    eventId,
    observedEventName: "Example Fest",
    reason: fixtureReason,
    evidenceIds: fixtureEvidence,
    event: {},
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      reason: fixtureReason,
      evidenceIds: fixtureEvidence,
      fields: {
        year: set(2027),
        dates: set({
          startsOn: "2027-07-01",
          endsOn: "2027-07-03",
          state: "confirmed" as const,
        }),
      },
    },
    checks: fixtureChecks([
      "identity",
      "currentAnnouncement",
      "currentDates",
      "previousCompletedEdition",
      "description",
    ]),
    unresolved: [],
  };
}
export function fixtureChecks(
  keys: string[],
  finding: CheckFinding["finding"] = "verified",
): CheckFinding[] {
  return keys.map((check) => ({
    check,
    finding,
    explanation: fixtureReason,
    evidenceIds: [],
    sourceIds: [],
  }));
}
export async function fixtureTool(
  context: Parameters<GenerateRole>[2],
  name: string,
  args: unknown,
): Promise<unknown> {
  const tool = context.tools?.[name] as {
    execute: (args: unknown, context: unknown) => Promise<unknown>;
  };
  return tool.execute(args, {});
}
export function approveFixtureReview(
  prepared: Parameters<typeof reviewSchema>[0],
): unknown {
  function approve(schema: Record<string, unknown>): unknown {
    if (schema.type === "null") {
      return null;
    }
    if (schema.type === "array") {
      return [];
    }
    const properties = schema.properties as Record<
      string,
      Record<string, unknown>
    >;
    if (properties.decision) {
      return { decision: "approve", reason: "Explicit fixture review" };
    }
    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, approve(value)]),
    );
  }
  return approve(z.toJSONSchema(reviewSchema(prepared)));
}

/** These answers use the current role contracts. Each override is one role response. */
export function fixtureRoleGenerator(
  responses: Partial<Record<Role, unknown | GenerateRole>> = {},
): GenerateRole {
  return async (role, prompt, call) => {
    const data = JSON.parse(prompt);
    if (role in responses) {
      const response = responses[role];
      return typeof response === "function"
        ? response(role, prompt, call)
        : response;
    }
    if (role === "reader") {
      return {
        overview: "Explicit fixture source",
        coverage: { found: [], notPublished: [] },
        topics: [...topics],
        statedYears: [],
        limitations: [],
        evidence: [{ quote: data.page, topics: [...topics] }],
      };
    }
    if (role === "research") {
      await fixtureTool(call, "inspectPage", {
        url: data.knownLinks[0]?.url ?? fixtureUrl,
      });
      return {
        checks: data.checks.map(({ key }: { key: string }) => ({
          check: key,
          sourceIds: ["s1"],
          blocker: null,
        })),
        unresolved: [],
      };
    }
    if (role === "general") {
      const result = fixtureTargets(data.assignment.identityContext.eventId);
      result.observedEventName =
        data.assignment.identityContext.requestedName ?? "Example Fest";
      result.checks = fixtureChecks(data.assignedChecks);
      return result;
    }
    if (role === "editor") {
      return approveFixtureReview(data.prepared);
    }
    const checks = fixtureChecks(data.assignedChecks ?? []);
    if (role === "tickets") {
      return { currentOrNextEdition: {}, checks, unresolved: [] };
    }
    if (role === "classification") {
      return {
        previousEdition: data.targets.previousEdition ? {} : null,
        currentOrNextEdition: data.targets.currentOrNextEdition ? {} : null,
        checks,
        unresolved: [],
      };
    }
    return {
      event: { socials: {} },
      currentOrNextEdition: data.targets.currentOrNextEdition ? {} : null,
      omitted: [],
      checks,
      unresolved: [],
    };
  };
}
export const generateFixtureLocation: NonNullable<
  ResearchDependencies["generateLocation"]
> = async (prompt) => fixtureLocationPlan(JSON.parse(prompt));
export function fixtureLocationPlan(input: LocationInput): LocationOutput {
  const slot = (name: "previousEdition" | "currentOrNextEdition") =>
    input[name]
      ? {
          fields: Object.fromEntries(
            locationTextFields.map((key) => [
              key,
              { action: "keep", reason: "Preserve saved place" },
            ]),
          ) as LocationFields,
          coordinates: {
            action: "keep" as const,
            reason: "Preserve saved point",
          },
          evidenceIds: [],
          unresolved: [],
        }
      : null;
  return {
    decision: {
      status: "ready",
      previousEdition: slot("previousEdition"),
      currentOrNextEdition: slot("currentOrNextEdition"),
    },
  };
}
export function fixtureDependencies(
  responses: Parameters<typeof fixtureRoleGenerator>[0] = {},
) {
  return {
    generateRole: fixtureRoleGenerator(responses),
    generateLocation: generateFixtureLocation,
    readPage: (async (url, { budget }) => {
      budget.consumePage();
      return {
        attemptedUrl: url,
        finalUrl: url,
        retrievedAt: "2026-11-01T00:00:00Z",
        method: "http",
        status: "ok",
        markdown:
          "Example Fest 2027, July 1–3, Lisbon, Portugal. [Official website](https://example.org/)",
      };
    }) satisfies NonNullable<ResearchDependencies["readPage"]>,
  };
}
export function continueStage<T>(result: StageResult<T>): T {
  if (result.status !== "continue") {
    throw new Error(
      `Fixture stage stopped: ${JSON.stringify(result.diagnostics)}`,
    );
  }
  return result.value;
}
export const runFixtureResearch: typeof runCatalogResearch = async (
  input,
  deps,
) => {
  const storage =
    deps.workflowStorage ?? createWorkflowStorage({ path: ":memory:" });
  try {
    return await runCatalogResearch(input, {
      ...deps,
      workflowStorage: storage,
    });
  } finally {
    if (!deps.workflowStorage) {
      await storage.close();
    }
  }
};
export const createFixtureIngestionWorkflow: typeof createCatalogIngestionWorkflow =
  (resolve, options) => {
    const workflow = createCatalogIngestionWorkflow(resolve, options);
    const storage = createWorkflowStorage({
      path: ":memory:",
      onFailure: workflow.historyControl.recoverHistory,
    });
    const host = new Mastra({
      workflows: { "catalog-ingestion": workflow },
      storage,
      logger: false,
      loggerOptions: { export: false },
    });
    trackFixtureWorkflowStore({ close: () => host.shutdown() });
    return host.getWorkflow("catalog-ingestion");
  };

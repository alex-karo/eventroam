import { fixtureRoleDependencies } from "./ingestion-roles";
import { validateResearch } from "@/test/ingestion-fixtures/research-validate";
import { stageDiagnostics } from "@/ingestion/stage";
import type { StageResult } from "@/ingestion/stage";
import type { CheckedResearch } from "@/test/ingestion-fixtures/research-validate";
import { Mastra } from "@mastra/core/mastra";
import { createWorkflowStorage } from "@/ingestion/runtime/workflow-storage";
import { trackFixtureWorkflowStore } from "./workflow-stores";
import { locationTextFields } from "@/ingestion/location/contracts";
import { buildFixtureLocationInput as buildLocationInput } from "./ingestion-location";
import { createGeocodingSession } from "@/ingestion/tools/geocode/tool";
import { createResearchBudget } from "@/ingestion/runtime/budget";
import { validateLocation } from "@/ingestion/location/validate";
import type {
  ResearchCandidate,
  ResearchEdition,
} from "@/ingestion/research/contracts";
import type { ResearchCatalog } from "@/ingestion/research/context";
import {
  prepareEditorPlan,
  prepareCatalogPlan,
  type AcceptedEditorPlan,
  type ReadyCatalogPlan,
} from "@/test/ingestion-fixtures/editor-prepare";
import type {
  CatalogResearchInput,
  ResearchDependencies,
} from "@/ingestion/contracts";
import type {
  EditionPlan,
  EditorPlan,
} from "@/test/ingestion-fixtures/editor-contracts";
import { modelContext } from "@/test/ingestion-fixtures/research-input";
import {
  runCatalogResearch as executeResearch,
  createCatalogIngestionWorkflow as createWorkflow,
} from "@/ingestion/workflow";

/** Explicit fixture decisions for existing writer/workflow regressions, not an evidence evaluator. */
export function fixtureEditorPlan(
  research: ResearchCandidate,
  saved: ReturnType<typeof modelContext> | null,
): EditorPlan {
  const data = research.data!;
  const action = (fact: { value: unknown; reason: string }) =>
    fact.value === null
      ? { action: "clear" as const, reason: fact.reason }
      : { action: "accept" as const };
  const editionPlan = (finding: ResearchEdition | null): EditionPlan | null => {
    if (!finding) {
      return null;
    }
    const { key, links, ...facts } = finding;
    const old = saved?.editions.find((edition) => edition.editionKey === key);
    return {
      editionKey: key,
      ...(!old ? { reason: "Fixture identifies distinct Edition" } : {}),
      fields: {
        ...Object.fromEntries(
          Object.entries(facts)
            .filter(
              ([name]) =>
                ![...locationTextFields, "coordinates"].includes(name as never),
            )
            .map(([name, fact]) => [name, action(fact)]),
        ),
        links: links.tickets
          ? {
              tickets: {
                action: "set",
                value: links.tickets,
                reason: "Fixture ticket association",
              },
            }
          : {},
      },
    };
  };
  return {
    status: "ready",
    event: {
      ...(!saved ? { reason: data.reason ?? "" } : {}),
      fields: {
        ...(data.summary ? { summary: action(data.summary) } : {}),
        links: {
          ...(data.links.website
            ? {
                website: {
                  action: "set",
                  value: data.links.website,
                  reason: "Fixture official association",
                },
              }
            : {}),
          socials: Object.fromEntries(
            Object.entries(data.links.socials)
              .filter(([, value]) => !!value)
              .map(([key, value]) => [
                key,
                {
                  action: "set",
                  value,
                  reason: "Fixture official association",
                },
              ]),
          ),
        },
      },
    },
    previousEdition: editionPlan(data.previousEdition),
    currentOrNextEdition: editionPlan(data.currentOrNextEdition),
    unresolved: [],
  };
}
export const generateFixtureEditor: NonNullable<
  ResearchDependencies["generateEditor"]
> = async (prompt) => {
  const { research, catalog } = JSON.parse(prompt);
  return fixtureEditorPlan(research, catalog);
};
/** Assert that a fixture can enter the next stage. */
export function continueStage<T>(result: StageResult<T>): T {
  if (result.status !== "continue") {
    throw new Error(
      `Fixture stage stopped: ${JSON.stringify(result.diagnostics)}`,
    );
  }
  return result.value;
}

/** A compact view for assertions about operations and diagnostics. */
export function inspectPreparation(
  result: StageResult<CheckedResearch | AcceptedEditorPlan | ReadyCatalogPlan>,
) {
  const plan =
    result.status === "continue" && "operations" in result.value
      ? result.value
      : null;
  return {
    ...stageDiagnostics(result),
    status: result.status,
    operations: plan?.operations ?? [],
    explanations: plan?.explanations ?? {},
  };
}

export function prepareEditorialFixture(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: { id: string; facet: string; slug: string }[],
) {
  const validated = validateResearch(raw, catalog, input);
  if (validated.status !== "continue") {
    return inspectPreparation(validated);
  }
  const saved = catalog.find(
    (event) => event.id === validated.value.matchedEventId,
  );
  const prepared = prepareEditorPlan(
    fixtureEditorPlan(
      validated.value.candidate,
      saved ? modelContext(saved) : null,
    ),
    validated.value,
    catalog,
    input,
    terms,
  );
  if (prepared.status !== "continue") {
    return inspectPreparation(prepared);
  }
  const locationInput = buildLocationInput(
    prepared.value.editorPlan,
    prepared.value.candidate.data,
    { catalog, terms: [], knownLinks: [], currentDate: "2026-10-03T12:00:00Z" },
    input,
  );
  const session = createGeocodingSession(locationInput, createResearchBudget());
  const location = validateLocation(
    fixtureLocationPlan({ ...locationInput, targetPoints: session.targets }),
    locationInput,
    session,
  );
  return inspectPreparation(
    prepareCatalogPlan(prepared.value, catalog, input, terms, location),
  );
}
export const runFixtureResearch: typeof executeResearch = async (
  input,
  deps,
) => {
  const storage =
    deps.workflowStorage ?? createWorkflowStorage({ path: ":memory:" });
  try {
    return await executeResearch(
      input,
      fixtureRoleDependencies(input, {
        generateEditor: generateFixtureEditor,
        ...deps,
        workflowStorage: storage,
      }),
    );
  } finally {
    if (!deps.workflowStorage) {
      await storage.close();
    }
  }
};
export const createFixtureIngestionWorkflow: typeof createWorkflow = (
  resolve,
  options,
) => {
  const workflow = createWorkflow(async (input) => {
    const resolved = await resolve(input);
    return {
      ...resolved,
      deps: fixtureRoleDependencies(
        { ...input, actor: "fixture" },
        {
          generateEditor: generateFixtureEditor,
          ...resolved.deps,
        },
      ),
    };
  }, options);
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

/** Offline HTTP fixtures answer the editor with the same explicit fixture decisions. */
export function fixtureEditorForProvider(
  body: Record<string, unknown>,
): unknown {
  const format = body.response_format as
    { json_schema?: { schema?: Record<string, unknown> } } | undefined;
  const schema = format?.json_schema?.schema;
  if ((schema?.properties as Record<string, unknown> | undefined)?.decision) {
    const messages = body.messages as {
      role: string;
      content: string | { text?: string }[];
    }[];
    const content = messages.findLast(
      (message) => message.role === "user",
    )!.content;
    const prompt =
      typeof content === "string"
        ? content
        : content.map((part) => part.text ?? "").join("");
    return editorWireFixture(fixtureLocationPlan(JSON.parse(prompt)), schema!);
  }
  if (!(schema?.properties as Record<string, unknown> | undefined)?.event) {
    return undefined;
  }
  const messages = body.messages as {
    role: string;
    content: string | { text?: string }[];
  }[];
  const content = messages.findLast(
    (message) => message.role === "user",
  )!.content;
  const prompt =
    typeof content === "string"
      ? content
      : content.map((part) => part.text ?? "").join("");
  const { research, catalog } = JSON.parse(prompt);
  return editorWireFixture(fixtureEditorPlan(research, catalog), schema!);
}

export function editorWireFixture(
  value: unknown,
  schema: Record<string, unknown>,
): unknown {
  if (value == null) {
    return value;
  }
  const choices = schema.anyOf as Record<string, unknown>[] | undefined;
  if (choices) {
    const entries = typeof value === "object" ? Object.entries(value) : [];
    const matching = choices.find((choice) => {
      const properties = choice.properties as
        Record<string, { const?: unknown }> | undefined;
      if (properties) {
        return entries.every(
          ([key, part]) =>
            key in properties &&
            (properties[key].const === undefined ||
              properties[key].const === part),
        );
      }
      return choice.const === value || choice.type === typeof value;
    });
    return editorWireFixture(value, matching ?? choices[0]);
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      editorWireFixture(item, schema.items as Record<string, unknown>),
    );
  }
  if (typeof value !== "object" || !schema.properties) {
    return value;
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(
      schema.properties as Record<string, Record<string, unknown>>,
    ).map(([key, part]) => [
      key,
      key in record ? editorWireFixture(record[key], part) : null,
    ]),
  );
}

/** Fixed Location decisions for tests of other ingestion stages. */
export const generateFixtureLocation: NonNullable<
  ResearchDependencies["generateLocation"]
> = async (prompt) => fixtureLocationPlan(JSON.parse(prompt));
export function fixtureLocationPlan(
  input: import("@/ingestion/location/input").LocationInput & {
    targetPoints?: Record<string, { sourceId?: string }>;
  },
): import("@/ingestion/location/contracts").LocationOutput {
  const slot = (name: "previousEdition" | "currentOrNextEdition") => {
    const target = input[name];
    if (!target) {
      return null;
    }
    const fields = Object.fromEntries(
      locationTextFields.map((field) => {
        const item = input.evidence
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              Array.isArray(item.editionClues) &&
              item.editionClues.includes(target.editionKey),
          )
          .find(
            (item) =>
              item &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              typeof item.quote === "string" &&
              item.quote.startsWith(`${field}: `),
          ) as { quote: string } | undefined;
        const fact = item
          ? JSON.parse(item.quote.slice(field.length + 2))
          : undefined;
        let action: import("@/ingestion/location/contracts").LocationFields["venueName"] =
          { action: "keep", reason: "Fixture preserves saved data" };
        if (fact?.value != null) {
          action = { action: "set", value: fact.value, reason: fact.reason };
        } else if (fact && target.saved?.[field]) {
          action = { action: "clear", reason: fact.reason };
        }
        return [field, action];
      }),
    ) as import("@/ingestion/location/contracts").LocationFields;
    const id = input.targetPoints?.[name]?.sourceId;
    let coordinates: import("@/ingestion/location/contracts").LocationSlot["coordinates"] =
      { action: "keep", reason: "Fixture preserves saved point" };
    const coordinateItem = input.evidence
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Array.isArray(item.editionClues) &&
          item.editionClues.includes(target.editionKey),
      )
      .find(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof item.quote === "string" &&
          item.quote.startsWith("coordinates: "),
      ) as { quote: string } | undefined;
    const coordinateFact = coordinateItem
      ? JSON.parse(coordinateItem.quote.slice(13))
      : undefined;
    if (coordinateFact?.value === null && target.saved?.latitude != null) {
      coordinates = { action: "clear", reason: "Fixture disproves point" };
    } else if (id) {
      coordinates = {
        action: "select",
        pointId: id,
        precision: coordinateFact?.value?.precision ?? "approximate",
        reason: coordinateFact?.reason ?? "Fixture map point",
      };
    }
    return {
      fields,
      coordinates,
      evidenceIds: input.evidence
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            Array.isArray(item.editionClues) &&
            item.editionClues.includes(target.editionKey),
        )
        .flatMap((item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof item.id === "string"
            ? [item.id]
            : [],
        ),
      unresolved: [],
    };
  };
  return {
    decision: {
      status: "ready",
      previousEdition: slot("previousEdition"),
      currentOrNextEdition: slot("currentOrNextEdition"),
    },
  };
}

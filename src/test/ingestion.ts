import type { ResearchCandidate } from "@/ingestion/research/contracts";
import type { ResearchCatalog } from "@/ingestion/research/context";
import {
  validateResearch,
  prepareEditorPlan,
} from "@/ingestion/editor/prepare";
import type {
  CatalogResearchInput,
  ResearchDependencies,
} from "@/ingestion/contracts";
import type { EditorPlan } from "@/ingestion/editor/contracts";
import { modelContext } from "@/ingestion/research/agent/input";
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
    editions: data.editions.map(({ key, classification, links, ...facts }) => {
      const old = saved?.editions.find((edition) => edition.editionKey === key);
      return {
        editionKey: key,
        ...(!old ? { reason: "Fixture identifies distinct Edition" } : {}),
        fields: {
          ...Object.fromEntries(
            Object.entries(facts).map(([name, fact]) => [name, action(fact)]),
          ),
          ...(classification ? { classification: action(classification) } : {}),
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
    }),
    unresolved: [],
  };
}
export const generateFixtureEditor: NonNullable<
  ResearchDependencies["generateEditor"]
> = async (prompt) => {
  const { research, catalog } = JSON.parse(prompt);
  return fixtureEditorPlan(research, catalog);
};
export function prepareEditorialFixture(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: { id: string; facet: string; slug: string }[],
) {
  const validated = validateResearch(raw, catalog, input);
  if (
    !validated.candidate ||
    validated.candidate.status === "failed" ||
    validated.skipped
  ) {
    return validated;
  }
  const saved = catalog.find((event) => event.id === validated.matchedEventId);
  return prepareEditorPlan(
    fixtureEditorPlan(validated.candidate, saved ? modelContext(saved) : null),
    validated,
    catalog,
    input,
    terms,
  );
}
export const runFixtureResearch: typeof executeResearch = (input, deps) =>
  executeResearch(input, { generateEditor: generateFixtureEditor, ...deps });
export const createFixtureIngestionWorkflow: typeof createWorkflow = (
  resolve,
  options,
) =>
  createWorkflow(async (input) => {
    const resolved = await resolve(input);
    return {
      ...resolved,
      deps: { generateEditor: generateFixtureEditor, ...resolved.deps },
    };
  }, options);

/** Offline HTTP fixtures answer the editor with the same explicit fixture decisions. */
export function fixtureEditorForProvider(
  body: Record<string, unknown>,
): unknown {
  const format = body.response_format as
    { json_schema?: { schema?: Record<string, unknown> } } | undefined;
  const schema = format?.json_schema?.schema;
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

function editorWireFixture(
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

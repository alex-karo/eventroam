import {
  fixtureRoleGenerator,
  fixtureLocationPlan,
  fixtureReaderOutput,
} from "./ingestion";
import type { GenerateRole, Role } from "@/ingestion/roles/invoke";
import { createResearchBudget } from "@/ingestion/runtime/budget";

type ObjectValue = Record<string, unknown>;

export type ProviderRequest = {
  messages: {
    role: string;
    content: unknown;
    tool_call_id?: string;
    tool_calls?: { id: string }[];
  }[];
  tools?: { function: { name: string } }[];
  response_format: { json_schema: { schema: ObjectValue } };
};

export function modelReply(
  content: string | null,
  tool?: { id: string; name: string; args: unknown },
) {
  return Response.json({
    id: "fixture",
    object: "chat.completion",
    created: 1,
    model: "fixture/model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          ...(tool && {
            tool_calls: [
              {
                id: tool.id,
                type: "function",
                function: {
                  name: tool.name,
                  arguments: JSON.stringify(tool.args),
                },
              },
            ],
          }),
        },
        finish_reason: tool ? "tool_calls" : "stop",
      },
    ],
  });
}

export function providerPrompt(
  body: ObjectValue,
): ReturnType<typeof JSON.parse> {
  const messages = body.messages as {
    role: string;
    content: string | { text?: string }[];
  }[];
  const content = messages.findLast(
    (message) => message.role === "user",
  )!.content;
  return JSON.parse(
    typeof content === "string"
      ? content
      : content.map((part) => part.text ?? "").join(""),
  );
}
export function providerRole(body: ObjectValue) {
  const fields = (
    body.response_format as { json_schema: { schema: ObjectValue } }
  ).json_schema.schema.properties as ObjectValue;
  if (fields.overview) {
    return "reader";
  }
  if (fields.checks && Object.keys(fields).length === 2) {
    return "research";
  }
  if (fields.result) {
    return "general";
  }
  if (fields.decision) {
    return "location";
  }
  if (fields.decisions) {
    return "editor";
  }
  if (fields.omitted) {
    return "links";
  }
  if (fields.previousEdition) {
    return "classification";
  }
  return "tickets";
}

export function wholeNumberedPage(page: string) {
  const end = Number([...page.matchAll(/^(\d+)\|/gm)].at(-1)?.[1]);
  if (!end) {
    throw new Error("Reader fixture needs a numbered page");
  }
  return end === 1 ? 1 : { start: 1, end };
}

/** Fill optional transport slots with null, as required by strict provider schemas. */
export function modelWireFixture(value: unknown, schema: ObjectValue): unknown {
  if (value == null) {
    return value;
  }
  const choices = schema.anyOf as ObjectValue[] | undefined;
  if (choices) {
    const entries = typeof value === "object" ? Object.entries(value) : [];
    const matchingChoices = choices.filter((choice) => {
      if (choice.type !== (Array.isArray(value) ? "array" : typeof value)) {
        return false;
      }
      const properties = choice.properties as
        Record<string, { const?: unknown }> | undefined;
      return (
        !properties ||
        entries.every(
          ([key, part]) =>
            key in properties &&
            (properties[key].const === undefined ||
              properties[key].const === part),
        )
      );
    });
    const matching =
      matchingChoices.find((choice) =>
        ((choice.required ?? []) as string[]).every((key) =>
          entries.some(([supplied]) => supplied === key),
        ),
      ) ?? matchingChoices[0];
    return modelWireFixture(value, matching ?? choices[0]);
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      modelWireFixture(item, schema.items as ObjectValue),
    );
  }
  if (typeof value !== "object" || !schema.properties) {
    return value;
  }
  const record = value as ObjectValue;
  return Object.fromEntries(
    Object.entries(schema.properties as Record<string, ObjectValue>).map(
      ([key, part]) => [
        key,
        key in record ? modelWireFixture(record[key], part) : null,
      ],
    ),
  );
}
/** Encode a direct role answer for the offline HTTP provider. */
export async function fixtureRoleForProvider(
  body: ObjectValue,
  responses: Partial<Record<Role, unknown | GenerateRole>> = {},
): Promise<ObjectValue> {
  const prompt = providerPrompt(body);
  const role = providerRole(body);
  const answer =
    role === "location"
      ? fixtureLocationPlan(prompt)
      : await fixtureRoleGenerator({
          reader: async () =>
            fixtureReaderOutput(wholeNumberedPage(prompt.page)),
          research: async (_role: unknown, raw: string) => ({
            checks: JSON.parse(raw).checks.map(({ key }: { key: string }) => ({
              check: key,
              sourceIds: [],
              blocker: null,
            })),
            unresolved: [],
          }),
          ...responses,
        })(role, JSON.stringify(prompt), {
          budget: createResearchBudget(),
          abortSignal: new AbortController().signal,
        });
  const schema = (
    body.response_format as { json_schema: { schema: ObjectValue } }
  ).json_schema.schema;
  return modelWireFixture(
    role === "general" ? { result: answer } : answer,
    schema,
  ) as ObjectValue;
}

import type {
  ResearchCandidate,
  ResearchEdition,
} from "@/ingestion/research/contracts";
import { locationTextFields } from "@/ingestion/location/contracts";
import { editorWireFixture } from "./ingestion";

type ObjectValue = Record<string, unknown>;
type Prompt = ReturnType<typeof JSON.parse>;
const allTopics = [
  "identity",
  "description",
  "dates",
  "status",
  "size",
  "tickets",
  "classification",
  "location",
  "links",
];
export function providerPrompt(body: ObjectValue): Prompt {
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
  const schema = (
    body.response_format as { json_schema: { schema: ObjectValue } }
  ).json_schema.schema;
  const fields = schema.properties as ObjectValue;
  if (fields.overview) {
    return "reader";
  }
  if (fields.completionReason) {
    return "research";
  }
  if (fields.result) {
    return "general";
  }
  if (fields.decision) {
    return "location";
  }
  if (fields.item) {
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
function approve(schema: ObjectValue): unknown {
  if (schema.type === "null") {
    return null;
  }
  if (schema.type === "array") {
    return [];
  }
  const properties = schema.properties as Record<string, ObjectValue>;
  if (properties.decision) {
    return { decision: "approve", reason: "Explicit fixture review" };
  }
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, approve(value)]),
  );
}
function target(
  value: ResearchEdition | null,
  action: (fact: { value: unknown; reason: string }) => unknown,
  ids: string[],
) {
  if (!value) {
    return null;
  }
  return {
    editionKey: value.key,
    reason: "Explicit fixture target",
    evidenceIds: ids,
    fields: Object.fromEntries(
      Object.entries(value)
        .filter(([key]) =>
          [
            "year",
            "dates",
            "scheduleStatus",
            "displayName",
            "sizeEstimate",
          ].includes(key),
        )
        .map(([key, fact]) => [
          key,
          action(fact as { value: unknown; reason: string }),
        ]),
    ),
  };
}
function general(
  prompt: Prompt,
  candidate: ResearchCandidate,
  ids: string[],
  action: (fact: { value: unknown; reason: string }) => unknown,
) {
  const data = candidate.data;
  if (!data) {
    return {
      decision: "uncertain",
      reason: `Explicit fixture has no usable identity: ${candidate.errors[0]?.message ?? "No support"}`,
      unresolved: candidate.unresolved,
    };
  }
  const identity = {
    eventId: data.eventId ?? prompt.assignment.identityContext.eventId,
    observedEventName: data.eventName,
    reason: data.reason ?? "Explicit fixture identity",
    evidenceIds: ids,
  };
  if (!prompt.assignment.identityContext.eventId && data.eventId) {
    return { decision: "duplicate", ...identity };
  }
  return {
    decision: "targets",
    ...identity,
    event: data.summary ? { summary: action(data.summary) } : {},
    previousEdition: target(data.previousEdition, action, ids),
    currentOrNextEdition: target(data.currentOrNextEdition, action, ids),
    checks: roleChecks(prompt, candidate),
    unresolved: [],
  };
}
function roleChecks(prompt: Prompt, candidate: ResearchCandidate) {
  const keys =
    prompt.assignedChecks ??
    prompt.checks?.map((item: { key: string }) => item.key) ??
    [];
  return keys.map((check: string) => ({
    check,
    finding: candidate.status === "partial" ? "unfinished" : "verified",
    explanation: "Explicit fixture check",
    evidenceIds: [],
    sourceIds: [],
  }));
}
function location(prompt: Prompt, candidate: ResearchCandidate) {
  const slot = (name: "previousEdition" | "currentOrNextEdition") => {
    if (!prompt[name]) {
      return null;
    }
    const finding = candidate.data?.[name];
    return {
      fields: Object.fromEntries(
        locationTextFields.map((field) => {
          const fact = finding?.[field];
          return [
            field,
            fact
              ? {
                  action: fact.value === null ? "clear" : "set",
                  ...(fact.value === null ? {} : { value: fact.value }),
                  reason: fact.reason,
                }
              : { action: "keep", reason: "Explicit fixture preserves place" },
          ];
        }),
      ),
      coordinates: {
        action: "keep",
        reason: "Explicit fixture preserves point",
      },
      evidenceIds: prompt.evidence.map((item: { id: string }) => item.id),
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
/** Offline domain fixtures selected by the requested role, never a live fallback. */
export function fixtureRoleForProvider(
  body: ObjectValue,
  candidate: ResearchCandidate,
): Record<string, unknown> {
  const prompt = providerPrompt(body);
  const role = providerRole(body);
  const schema = (
    body.response_format as { json_schema: { schema: ObjectValue } }
  ).json_schema.schema;
  const ids =
    prompt.corpus?.evidence.map((item: { id: string }) => item.id) ?? [];
  const action = (fact: { value: unknown; reason: string }) => ({
    action: fact.value === null ? "clear" : "set",
    ...(fact.value === null ? {} : { value: fact.value }),
    reason: fact.reason,
    evidenceIds: ids,
  });
  const values = () => {
    if (role === "reader") {
      return {
        overview:
          candidate.data?.sources[0]?.information ?? "Explicit fixture source",
        topics: allTopics,
        statedYears: [],
        limitations: [],
        evidence:
          prompt.page.length <= 24000
            ? [
                {
                  quote: prompt.page,
                  context: [],
                  topics: allTopics,
                  editionClues: [],
                  uncertainty: null,
                },
              ]
            : [],
      };
    }
    if (role === "research") {
      return {
        checks: roleChecks(prompt, candidate),
        completionReason: "Explicit fixture collection complete",
        unresolved: candidate.unresolved,
      };
    }
    if (role === "general") {
      return { result: general(prompt, candidate, ids, action) };
    }
    if (role === "location") {
      return location(prompt, candidate);
    }
    if (role === "editor") {
      return approve(prompt.decisionShape);
    }
    if (role === "links") {
      return {
        event: { socials: {} },
        currentOrNextEdition: prompt.targets.currentOrNextEdition ? {} : null,
        checks: roleChecks(prompt, candidate),
        omitted: [],
        unresolved: [],
      };
    }
    if (role === "classification") {
      return {
        previousEdition: prompt.targets.previousEdition ? {} : null,
        currentOrNextEdition: prompt.targets.currentOrNextEdition ? {} : null,
        checks: roleChecks(prompt, candidate),
        unresolved: [],
      };
    }
    return {
      currentOrNextEdition: {},
      checks: roleChecks(prompt, candidate),
      unresolved: [],
    };
  };
  return editorWireFixture(values(), schema) as Record<string, unknown>;
}

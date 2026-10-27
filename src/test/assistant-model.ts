import { randomUUID } from "node:crypto";
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";
import {
  INSPECT_RUN_SQL,
  RUN_EVIDENCE_SQL,
} from "../mastra/catalog-assistant/tools/query-catalog/guide";

/** Offline protocol fixture. It tests the agent/tool link, not model reasoning. */
export function createAssistantFixtureModel() {
  const execute = async ({
    prompt,
  }: Parameters<MastraLanguageModelV2Mock["doStream"]>[0]): ReturnType<
    MastraLanguageModelV2Mock["doStream"]
  > => {
    const lastUser = prompt.findLastIndex((message) => message.role === "user");
    const owner = JSON.stringify(prompt[lastUser]?.content ?? "");
    const turn = prompt.slice(lastUser + 1);
    const toolResults = turn
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content);
    const results = toolResults.map((part) =>
      part.type === "tool-result" && part.output.type === "json"
        ? part.output.value
        : null,
    );
    let call: { name: string; input: unknown } | undefined;
    let text = "";
    if (results.length === 0) {
      ({ call, text } = initialReply(owner, prompt, lastUser));
    } else if (/analyze run/i.test(owner) && results.length === 1) {
      const result = results[0] as {
        ok?: boolean;
        rows?: unknown[][];
        truncated?: boolean;
      };
      if (result.truncated) {
        text =
          "The query is truncated. Evidence is incomplete; this does not prove the run is absent.";
      } else if (!result.rows?.length) {
        text = "The run is unknown.";
      } else if (!result.rows[0][6]) {
        text = "The attempt exists without a saved final report.";
      } else if (!result.rows[0][7] || result.rows[0][8] !== 7) {
        text = "The report JSON or version cannot be interpreted.";
      } else {
        call = {
          name: "query_catalog",
          input: {
            sql: RUN_EVIDENCE_SQL,
            parameters: [/analyze run ([a-z0-9-]+)/i.exec(owner)![1]],
          },
        };
      }
    } else if (/analyze run/i.test(owner)) {
      text = `Saved run evidence (selected fields; no independent source check): ${JSON.stringify(results)}. dryRun true means proposed changes; false means apply. An unchanged outcome can have partial research. Missing evidence remains unresolved.`;
    } else {
      text = `Tool result: ${JSON.stringify(results)}. Use ingestionRunId for saved reports; engineRunId is engine correlation. A preview proposes changes. Persistence failure can coexist with known commits.`;
    }
    const parts = call
      ? [
          {
            type: "tool-call" as const,
            toolCallId: randomUUID(),
            toolName: call.name,
            input: JSON.stringify(call.input),
          },
        ]
      : [
          { type: "text-start" as const, id: "text" },
          { type: "text-delta" as const, id: "text", delta: text },
          { type: "text-end" as const, id: "text" },
        ];
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const part of parts) {
            controller.enqueue(part);
          }
          controller.enqueue({
            type: "finish",
            finishReason: call ? "tool-calls" : "stop",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    };
  };
  return new MastraLanguageModelV2Mock({
    provider: "fixture",
    modelId: "catalog-assistant",
    doStream: execute,
    doGenerate: async (options) => {
      const response = await execute(options);
      const content: Array<
        | { type: "text"; text: string }
        | {
            type: "tool-call";
            toolCallId: string;
            toolName: string;
            input: string;
          }
      > = [];
      let finishReason: "stop" | "tool-calls" = "stop";
      for await (const part of response.stream) {
        if (part.type === "text-delta") {
          content.push({ type: "text", text: part.delta });
        }
        if (part.type === "tool-call") {
          content.push(part);
          finishReason = "tool-calls";
        }
      }
      return {
        content,
        finishReason,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
}

function initialReply(
  owner: string,
  prompt: Parameters<MastraLanguageModelV2Mock["doStream"]>[0]["prompt"],
  lastUser: number,
) {
  let call: { name: string; input: unknown } | undefined;
  let text = "";
  const ids = owner.match(/[0-9a-f]{8}-[0-9a-f-]{27}/gi) ?? [];
  if (/\b(update|preview)\b/i.test(owner)) {
    if (!ids.length) {
      text = "Specify the Event IDs to refresh.";
    } else {
      call = {
        name: "refresh_events",
        input: {
          eventIds: ids,
          dryRun: !/\bupdate\b/i.test(owner),
          scope: "full",
        },
      };
    }
  } else if (/analyze run ([a-z0-9-]+)/i.test(owner)) {
    call = {
      name: "query_catalog",
      input: {
        sql: INSPECT_RUN_SQL,
        parameters: [/analyze run ([a-z0-9-]+)/i.exec(owner)![1]],
      },
    };
  } else if (/second/i.test(owner)) {
    const previous = prompt
      .slice(0, lastUser)
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content)
      .filter(
        (part) =>
          part.type === "tool-result" && part.toolName === "query_catalog",
      );
    const last = previous.at(-1);
    const data =
      last?.type === "tool-result" && last.output.type === "json"
        ? (last.output.value as { rows?: string[][] })
        : undefined;
    const priorIds = data?.rows?.map((row) => row[0]) ?? [];
    if (priorIds.length < 2) {
      text = "No prior second Event in this conversation. Specify an Event ID.";
    } else {
      call = {
        name: "query_catalog",
        input: {
          sql: "SELECT id, canonical_name FROM events WHERE id=?",
          parameters: [priorIds[1]],
        },
      };
    }
  } else {
    call = {
      name: "query_catalog",
      input: {
        sql: "SELECT id, canonical_name FROM events ORDER BY canonical_name LIMIT 3",
      },
    };
  }

  return { call, text };
}

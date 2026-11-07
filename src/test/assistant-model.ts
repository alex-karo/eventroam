import { randomUUID } from "node:crypto";
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";
import {
  BATCH_COUNTS_SQL,
  INSPECT_RUN_SQL,
  INSPECT_RUN_STATE_SQL,
  RUN_EVIDENCE_SQL,
} from "./catalog-sql";

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
    const results = toolResults
      .filter(
        (part) =>
          part.type === "tool-result" && !part.toolName.startsWith("skill"),
      )
      .map((part) => (part.output.type === "json" ? part.output.value : null));
    const { call: initialCall, text } = fixtureReply(
      owner,
      results,
      toolResults,
      prompt,
      lastUser,
    );
    let call = initialCall;
    if (call?.name === "query_catalog") {
      const sql = (call.input as { sql: string }).sql;
      const reference = [
        ["batch-counts.sql", BATCH_COUNTS_SQL],
        ["inspect-run.sql", INSPECT_RUN_SQL],
        ["inspect-run-state.sql", INSPECT_RUN_STATE_SQL],
        ["run-evidence.sql", RUN_EVIDENCE_SQL],
      ].find(([, example]) => example === sql)?.[0];
      const loaded = toolResults.some(
        (part) =>
          part.type === "tool-result" &&
          part.toolName === "skill_read" &&
          (part.output.type === "json" || part.output.type === "text") &&
          part.output.value === `${sql}\n`,
      );
      if (reference && !loaded) {
        call = {
          name: "skill_read",
          input: { skillName: "catalog-sql", path: `references/${reference}` },
        };
      }
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

function inspectRunReply(value: unknown, runId: string) {
  const result = value as {
    ok?: boolean;
    rows?: unknown[][];
    truncated?: boolean;
  };
  let call: { name: string; input: unknown } | undefined;
  let text = "";
  if (!result.ok) {
    call = {
      name: "query_catalog",
      input: { sql: INSPECT_RUN_STATE_SQL, parameters: [runId] },
    };
  } else if (result.truncated) {
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
      input: { sql: RUN_EVIDENCE_SQL, parameters: [runId] },
    };
  }
  return { call, text };
}

function reportStateReply(result: unknown): string {
  const state = result as {
    ok?: boolean;
    rows?: unknown[][];
    truncated?: boolean;
  };
  if (!state.ok || state.truncated) {
    return "The report state cannot be confirmed. Evidence is incomplete.";
  }
  if (!state.rows?.length) {
    return "The run is unknown.";
  }
  if (!state.rows[0][6]) {
    return "The attempt exists without a saved final report.";
  }
  if (!state.rows[0][7] || !state.rows[0][8]) {
    return "The stored JSON cannot be interpreted.";
  }
  return "The report query failed. Its outcome cannot be confirmed.";
}

function initialReply(
  owner: string,
  prompt: Parameters<MastraLanguageModelV2Mock["doStream"]>[0]["prompt"],
  lastUser: number,
) {
  let call: { name: string; input: unknown } | undefined;
  let text = "";
  const ids = owner.match(/[0-9a-f]{8}-[0-9a-f-]{27}/gi) ?? [];
  if (/find new festival candidates|add both Events/i.test(owner)) {
    return discoveryReply(owner, prompt, lastUser);
  }
  if (/count France Events/i.test(owner)) {
    call = {
      name: "query_catalog",
      input: {
        sql: "SELECT count(DISTINCT event_id) AS count FROM editions WHERE country_code='FR'",
      },
    };
  } else if (/update all France Events/i.test(owner)) {
    call = {
      name: "query_catalog",
      input: {
        sql: "SELECT DISTINCT event_id FROM editions WHERE country_code='FR' ORDER BY event_id",
      },
    };
  } else if (/progress batch/i.test(owner) && ids.length === 1) {
    call = {
      name: "query_catalog",
      input: {
        sql: BATCH_COUNTS_SQL,
        parameters: ids,
      },
    };
  } else if (/cancel batch/i.test(owner) && ids.length === 1) {
    call = { name: "cancel_batch", input: { batchId: ids[0] } };
  } else if (/find lost batch/i.test(owner) && ids.length) {
    call = {
      name: "query_catalog",
      input: {
        sql: `SELECT batch_id,created_at,json_extract(input,'$.scope') AS scope,dry_run,count(*) FROM ingestion_jobs WHERE mode='refresh' GROUP BY batch_id HAVING count(*)=? AND sum(json_extract(input,'$.eventId') IN (${ids.map(() => "?").join(",")}))=? AND scope='full' AND dry_run=1 ORDER BY created_at,batch_id`,
        parameters: [ids.length, ...ids, ids.length],
      },
    };
  } else if (/\b(update|preview)\b/i.test(owner)) {
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
    return previousEventReply(prompt, lastUser);
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

function selectedEventsReply(value: unknown) {
  const selected = value as {
    ok?: boolean;
    truncated?: boolean;
    rows?: string[][];
  };
  if (!selected.ok || selected.truncated || !selected.rows?.length) {
    return {
      text: "The complete Event selection is unavailable. Please narrow or clarify the selection.",
    };
  }
  return {
    text: "",
    call: {
      name: "refresh_events",
      input: {
        eventIds: selected.rows.map((row) => row[0]),
        scope: "full",
        dryRun: false,
      },
    },
  };
}

function savedBatchReply(value: unknown) {
  const found = value as {
    ok?: boolean;
    truncated?: boolean;
    rows?: unknown[][];
  };
  if (!found.ok || found.truncated || found.rows?.length !== 1) {
    return "Saved batch evidence is incomplete or ambiguous. Please select a batch or clarify the request. No work was submitted.";
  }
  return `Resolved saved batch ${found.rows[0][0]}. Read progress through query_catalog; no work was submitted.`;
}

function previousEventReply(
  prompt: Parameters<MastraLanguageModelV2Mock["doStream"]>[0]["prompt"],
  lastUser: number,
) {
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
    return {
      text: "No prior second Event in this conversation. Specify an Event ID.",
    };
  }
  return {
    text: "",
    call: {
      name: "query_catalog",
      input: {
        sql: "SELECT id, canonical_name FROM events WHERE id=?",
        parameters: [priorIds[1]],
      },
    },
  };
}

function discoveryReply(
  owner: string,
  prompt: Parameters<MastraLanguageModelV2Mock["doStream"]>[0]["prompt"],
  lastUser: number,
) {
  let call: { name: string; input: unknown } | undefined;
  let text = "";
  if (/find new festival candidates/i.test(owner)) {
    call = {
      name: "search_web",
      input: { query: "Find new festival candidates" },
    };
  } else if (/add both Events/i.test(owner)) {
    const prior = prompt
      .slice(0, lastUser)
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content)
      .findLast(
        (part) => part.type === "tool-result" && part.toolName === "search_web",
      );
    const result =
      prior?.type === "tool-result" && prior.output.type === "json"
        ? (prior.output.value as {
            candidates?: { title: string; url: string }[];
          })
        : undefined;
    if (result?.candidates?.length === 2) {
      call = {
        name: "add_events",
        input: {
          inputs: result.candidates.map(
            (candidate) => `${candidate.title}\n${candidate.url}`,
          ),
          dryRun: false,
        },
      };
    } else {
      text = "Clarify the intended Events.";
    }
  }
  return { call, text };
}

function fixtureEditReply(owner: string, results: unknown[]) {
  if (!/fixture edit/i.test(owner)) {
    return;
  }
  const refreshFirst = /refresh before/i.test(owner);
  const editResultCount = refreshFirst ? 2 : 1;
  if (
    (refreshFirst && results.length === 0) ||
    (/then refresh/i.test(owner) && results.length === editResultCount)
  ) {
    return {
      text: "",
      call: {
        name: "refresh_events",
        input: {
          eventIds: ["00000000-0000-4000-8000-000000000001"],
          scope: "full",
          dryRun: !/apply refresh/i.test(owner),
        },
      },
    };
  }
  if (results.length && !(refreshFirst && results.length === 1)) {
    return { text: `Fixture edit result: ${JSON.stringify(results)}` };
  }
  return {
    text: "",
    call: {
      name: "edit_catalog",
      input: {
        auditMode: "record",
        targets: [
          {
            kind: "event",
            links: null,
            id: "00000000-0000-4000-8000-000000000001",
            changes: {
              canonicalName: {
                before: "Studio Fixture Festival",
                after: "First name",
              },
            },
          },
        ],
      },
    },
  };
}

type FixturePrompt = Parameters<
  MastraLanguageModelV2Mock["doStream"]
>[0]["prompt"];
type FixtureToolResults = Extract<
  FixturePrompt[number],
  { role: "tool" }
>["content"];

function fixtureReply(
  owner: string,
  results: unknown[],
  toolResults: FixtureToolResults,
  prompt: FixturePrompt,
  lastUser: number,
): { call?: { name: string; input: unknown }; text: string } {
  const edit = fixtureEditReply(owner, results);
  if (edit) {
    return edit;
  }
  let call: { name: string; input: unknown } | undefined;
  let text = "";
  if (toolResults.length === 0) {
    call = { name: "skill", input: { name: "catalog-sql" } };
  } else if (results.length === 0) {
    ({ call, text } = initialReply(owner, prompt, lastUser));
  } else if (/update all France Events/i.test(owner) && results.length === 1) {
    ({ call, text } = selectedEventsReply(results[0]));
  } else if (/find lost batch/i.test(owner)) {
    text = savedBatchReply(results[0]);
  } else if (/analyze run/i.test(owner) && results.length === 1) {
    ({ call, text } = inspectRunReply(
      results[0],
      /analyze run ([a-z0-9-]+)/i.exec(owner)![1],
    ));
  } else if (/analyze run/i.test(owner)) {
    const first = results[0] as { ok?: boolean };
    if (!first.ok) {
      text = reportStateReply(results[1]);
    } else {
      text = `Saved run evidence (selected fields; no independent source check): ${JSON.stringify(results)}. dryRun true means proposed changes; false means apply. An unchanged outcome can have partial research. Missing evidence remains unresolved.`;
    }
  } else {
    text = `Tool result: ${JSON.stringify(results)}. Accepted jobs are not completed ingestion. Done means processing ended, not success. Stored running state does not prove queue health. Read saved reports through query_catalog. A preview proposes changes.`;
  }
  return { call, text };
}

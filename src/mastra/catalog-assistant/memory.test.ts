import { linkSync, symlinkSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createMockModel } from "@mastra/core/test-utils/llm-mock";
import { testDatabase } from "@/test/database";
import { createObservabilityStore } from "../../ingestion/runtime/observability/storage";
import { chatDatabasePath, createChatMemory, StudioMastra } from "./memory";
import { createCatalogAssistant } from ".";

afterEach(() => vi.unstubAllEnvs());

test("history token budget removes old prompt context without deleting saved messages", async () => {
  const chat = await createChatMemory(
    join(dirname(testDatabase().path), "chat.sqlite"),
  );
  const prompts: string[] = [];
  const capture = (options: { prompt: unknown }) => {
    prompts.push(JSON.stringify(options.prompt));
  };
  const assistant = createCatalogAssistant(
    { createRun: vi.fn() },
    chat.memory,
    createMockModel({
      version: "v2",
      mockText: "Ready.",
      spyGenerate: capture,
      spyStream: capture,
    }),
  );
  try {
    await chat.memory.createThread({ threadId: "budget", resourceId: "owner" });
    await chat.memory.saveMessages({
      messages: (
        [
          [
            "old",
            "assistant",
            "OLD_LARGE_CONTEXT " + "old detail ".repeat(30_000),
          ],
          ["recent-user", "user", "Remember the recent Event selection"],
          ["recent-answer", "assistant", "RECENT_EVENT_SELECTION abc"],
        ] as const
      ).map(([id, role, text], index) => ({
        id,
        role,
        threadId: "budget",
        resourceId: "owner",
        createdAt: new Date(Date.now() - 10_000 + index),
        content: { format: 2, parts: [{ type: "text", text }] },
      })),
    });
    await assistant.generate("CURRENT_OWNER_QUESTION", {
      memory: { thread: "budget", resource: "owner" },
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain("OLD_LARGE_CONTEXT");
    expect(prompts[0]).toContain("RECENT_EVENT_SELECTION");
    expect(prompts[0]).toContain("CURRENT_OWNER_QUESTION");
    expect(prompts[0]).toContain(
      "Read and analysis requests do not authorize ingestion",
    );
    await chat.memory.settled();
    const store = await chat.storage.getStore("memory");
    const saved = await store!.listMessages({ threadId: "budget" });
    expect(saved.messages.some(({ id }) => id === "old")).toBe(true);
  } finally {
    await chat.memory.settled();
    await chat.storage.close();
  }
});

test("chat storage is separate even with path aliases", () => {
  const db = testDatabase(),
    root = dirname(db.path);
  const env = {
    ...process.env,
    DATABASE_PATH: db.path,
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(root, "traces.duckdb"),
  };
  expect(
    chatDatabasePath({
      ...env,
      CATALOG_CHAT_DATABASE_PATH: join(root, "chat.sqlite"),
    }),
  ).toBe(join(root, "chat.sqlite"));
  const hard = join(root, "hard.sqlite"),
    sym = join(root, "sym.sqlite");
  linkSync(db.path, hard);
  symlinkSync(db.path, sym);
  for (const path of [
    db.path,
    db.path + "-wal",
    hard,
    sym,
    env.CATALOG_OBSERVABILITY_DATABASE_PATH,
  ]) {
    expect(() =>
      chatDatabasePath({ ...env, CATALOG_CHAT_DATABASE_PATH: path }),
    ).toThrow();
  }
});

test("Memory owns persistent history, Studio selects it, and shutdown closes both stores", async () => {
  const db = testDatabase(),
    root = dirname(db.path),
    original = readFileSync(db.path);
  const path = join(root, "chat.sqlite");
  const observability = await createObservabilityStore({
    ...process.env,
    DATABASE_PATH: db.path,
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(root, "traces.duckdb"),
  });
  await observability.init();
  const chat = await createChatMemory(path);
  const closeChat = vi.spyOn(chat.storage, "close"),
    closeTrace = vi.spyOn(observability, "close");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const assistant = createCatalogAssistant({ createRun: vi.fn() }, chat.memory);
  await expect(assistant.getModel()).resolves.toBeDefined();
  const mastra = new StudioMastra(
    {
      agents: { "catalog-assistant": assistant },
      storage: observability,
      logger: false,
    },
    chat,
  );
  try {
    const memory = await mastra.getAgent("catalog-assistant").getMemory();
    expect(memory).toBe(chat.memory);
    expect(memory!.storage.id).toBe(chat.storage.id);
    await memory!.createThread({
      threadId: "one",
      resourceId: "owner",
      title: "Selected Events",
    });
    await memory!.saveMessages({
      messages: [
        {
          id: "message-one",
          threadId: "one",
          resourceId: "owner",
          role: "assistant",
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: "text", text: "Selected Event abc" }],
          },
        },
      ],
    });
  } finally {
    await mastra.shutdown();
  }
  expect(closeChat).toHaveBeenCalledTimes(1);
  expect(closeTrace).toHaveBeenCalledTimes(1);
  const reopened = await createChatMemory(path);
  try {
    expect(
      await reopened.memory.getThreadById({ threadId: "one" }),
    ).toMatchObject({ title: "Selected Events" });
    const result = await reopened.memory.recall({
      threadId: "one",
      resourceId: "owner",
    });
    expect(JSON.stringify(result)).toContain("Selected Event abc");
    expect(
      await reopened.memory.getThreadById({ threadId: "other" }),
    ).toBeNull();
    expect(readFileSync(db.path)).toEqual(original);
  } finally {
    await reopened.storage.close();
  }
});

import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { createAssistantFixtureModel } from "@/test/assistant-model";
import { createChatMemory } from "../catalog-assistant/memory";
import { createCatalogAssistant } from "../catalog-assistant";
import { createCatalogResearcher } from ".";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("offline Studio conversation finds two candidates, adds both, and reads the accepted batch", async () => {
  const db = testDatabase();
  vi.stubEnv("DATABASE_PATH", db.path);
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              annotations: [
                {
                  type: "url_citation",
                  url_citation: {
                    title: "Alpha Festival",
                    url: "https://alpha.test/",
                  },
                },
                {
                  type: "url_citation",
                  url_citation: {
                    title: "Beta Festival",
                    url: "https://beta.test/",
                  },
                },
              ],
            },
          },
        ],
      }),
    ),
  );
  const chat = await createChatMemory(join(dirname(db.path), "chat.sqlite"));
  const model = createAssistantFixtureModel();
  const researcher = createCatalogResearcher(chat.memory, model);
  const assistant = createCatalogAssistant(chat.memory, model);
  const ask = (text: string) =>
    researcher.generate(text, {
      memory: { thread: "research", resource: "owner" },
    });
  try {
    expect(Object.keys(await researcher.listTools())).toEqual(
      expect.arrayContaining(["search_web", "add_events", "query_catalog"]),
    );
    expect(Object.keys(await researcher.listTools())).not.toContain(
      "cancel_batch",
    );
    expect(Object.keys(await assistant.listTools())).toContain("cancel_batch");
    const found = await ask("find new festival candidates");
    expect(found.text).toContain("https://alpha.test/");
    expect(found.text).toContain("https://beta.test/");
    expect(
      db.client.prepare("SELECT count(*) FROM ingestion_jobs").pluck().get(),
    ).toBe(0);
    const accepted = await ask("add both Events");
    expect(accepted.text).toContain('"acceptedCount":2');
    const batchId = db.client
      .prepare("SELECT batch_id FROM ingestion_jobs LIMIT 1")
      .pluck()
      .get() as string;
    expect(accepted.text).toContain(batchId);
    expect(
      db.client
        .prepare(
          "SELECT add_input,dry_run FROM ingestion_jobs ORDER BY position",
        )
        .all(),
    ).toEqual([
      { add_input: "Alpha Festival\nhttps://alpha.test/", dry_run: 0 },
      { add_input: "Beta Festival\nhttps://beta.test/", dry_run: 0 },
    ]);
    const status = await ask(`progress batch ${batchId}`);
    expect(status.text).toContain("pending");
    expect(
      db.client.prepare("SELECT count(*) FROM ingestion_jobs").pluck().get(),
    ).toBe(2);
  } finally {
    await chat.memory.settled();
    await chat.storage.close();
  }
});

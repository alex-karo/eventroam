import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sameFile } from "../../db/file-identity";
import { pathToFileURL } from "node:url";
import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { observabilityDatabasePath } from "../../ingestion/runtime/observability/storage";
import {
  createDiagnostics,
  ObservabilityLogger,
} from "../../ingestion/runtime/observability/diagnostics";
import { flushObservability } from "../../ingestion/runtime/observability/runtime";

export function chatDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
) {
  const path = resolve(
    cwd,
    env.CATALOG_CHAT_DATABASE_PATH?.trim() || "data/mastra-chat.sqlite",
  );
  const catalog = resolve(
    cwd,
    env.DATABASE_PATH?.trim() || "data/eventroam.sqlite",
  );
  const observability = observabilityDatabasePath(env, cwd, [
    path,
    `${path}-wal`,
    `${path}-shm`,
  ]);
  const protectedPaths = [
    catalog,
    `${catalog}-wal`,
    `${catalog}-shm`,
    `${catalog}-journal`,
    observability,
    `${observability}.wal`,
  ];
  const chatPaths = [path, `${path}-wal`, `${path}-shm`, `${path}-journal`];
  if (
    chatPaths.some((chat) =>
      protectedPaths.some((file) => sameFile(chat, file)),
    )
  ) {
    throw new Error(
      "Chat storage must be separate from catalog and observability storage",
    );
  }
  return path;
}

export async function createChatMemory(path = chatDatabasePath()) {
  await mkdir(dirname(path), { recursive: true });
  const storage = new LibSQLStore({
    id: "catalog-chat",
    url: pathToFileURL(path).href,
  });
  try {
    await storage.init();
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 40,
        messageHistory: { maxTokens: 16_000, atMaxRemoveTokens: 4_000 },
        semanticRecall: false,
        workingMemory: { enabled: false },
        observationalMemory: false,
        generateTitle: false,
      },
    });
    return { memory, storage };
  } catch (error) {
    await storage.close();
    throw error;
  }
}

/** Mastra closes its own store. This owner also closes Memory's dedicated store. */
export class StudioMastra extends Mastra {
  private readonly diagnose = createDiagnostics();
  constructor(
    config: ConstructorParameters<typeof Mastra>[0],
    private readonly chat: Awaited<ReturnType<typeof createChatMemory>>,
  ) {
    super(config);
    config?.observability?.setLogger({
      logger: new ObservabilityLogger(() =>
        this.diagnose("trace_export_failed"),
      ),
    });
  }
  override async shutdown(options?: Parameters<Mastra["shutdown"]>[0]) {
    try {
      await flushObservability(this, this.diagnose);
      await super.shutdown(options);
    } finally {
      await this.chat.memory.settled();
      await this.chat.storage.close();
    }
  }
}

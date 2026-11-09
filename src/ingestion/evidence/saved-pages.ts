import {
  Workspace,
  LocalFilesystem,
  createWorkspaceTools,
  WORKSPACE_TOOLS,
} from "@mastra/core/workspace";
import { basename, dirname } from "node:path";
import type { FrozenCorpus } from "./contracts";
import { readCanonicalSource } from "./storage";

export async function savedPages(corpus: FrozenCorpus, signal: AbortSignal) {
  const sources = corpus.sources.filter((source) =>
    Boolean(source.markdownPath),
  );
  const sourceFiles = sources.map((source) => ({
    sourceId: source.id,
    path: basename(source.markdownPath!),
    url: source.finalUrl,
    overview: source.overview ?? null,
  }));
  const tools = sources.length
    ? await createWorkspaceTools(
        new Workspace({
          filesystem: new LocalFilesystem({
            basePath: dirname(sources[0].markdownPath!),
            readOnly: true,
          }),
          tools: {
            enabled: false,
            [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true },
            hooks: {
              beforeToolCall: async ({ input }) => {
                signal.throwIfAborted();
                const { path } = input as { path: string };
                const source = sources.find(
                  (source) => basename(source.markdownPath!) === path,
                );
                if (!source) {
                  throw new Error("Source file is not saved in this run");
                }
                await readCanonicalSource(source);
              },
            },
          },
        }),
      )
    : {};
  return { sourceFiles, tools };
}

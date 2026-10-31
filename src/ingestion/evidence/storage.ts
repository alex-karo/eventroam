import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { ReadPageResult } from "../tools/read-page/contracts";
import type { Source, Evidence, FrozenCorpus } from "./contracts";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
export function sourceArtifactRoot(
  env: Record<string, string | undefined> = process.env,
) {
  return resolve(
    projectRoot,
    env.CATALOG_SOURCE_DIRECTORY?.trim() || "data/ingestion-sources",
  );
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** A run owns independent immutable source files. No manifest is needed. */
export function createCorpusStorage(
  runId: string,
  root = sourceArtifactRoot(),
) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) {
    throw new Error("Invalid source run ID");
  }
  const directory = resolve(root, runId, "sources");
  const sources: Source[] = [];
  const evidence: Evidence[] = [];
  let frozen = false;
  let sourceNumber = 0;
  const assertOpen = () => {
    if (frozen) {
      throw new Error("Source corpus is frozen");
    }
  };
  return {
    sources,
    evidence,
    async savePage(read: ReadPageResult) {
      assertOpen();
      const { markdown, ...metadata } = read;
      const source: Source = {
        ...metadata,
        id: `s${++sourceNumber}`,
        processing: "unprocessed",
        limitations: [],
      };
      // Failed retrievals have no invented file references.
      if (read.status === "ok") {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        assertOpen();
        const markdownPath = resolve(directory, `${source.id}.md`);
        source.contentHash = hash(markdown);
        const provenance = {
          application: {
            runId,
            ...metadata,
            sourceId: source.id,
            bodyHash: source.contentHash,
          },
          websiteMetadata:
            "Metadata in the canonical body is source content, not application provenance",
        };
        await writeFile(
          markdownPath,
          `---\n${JSON.stringify(provenance, null, 2)}\n---\n${markdown}`,
          { flag: "wx", mode: 0o600 },
        );
        source.markdownPath = markdownPath;
      }
      assertOpen();
      sources.push(source);
      return source;
    },
    async saveEvidence(source: Source, items: Evidence[]) {
      assertOpen();
      if (!source.markdownPath) {
        throw new Error("Source body was not saved");
      }
      const path = resolve(directory, `${source.id}.evidence.json`);
      await writeFile(
        path,
        JSON.stringify({ source, evidence: items }, null, 2),
        { flag: "wx", mode: 0o600 },
      );
      assertOpen();
      source.evidencePath = path;
      evidence.push(...items);
    },
    freeze(): FrozenCorpus {
      assertOpen();
      frozen = true;
      const snapshot = structuredClone({ sources, evidence });
      return { version: hash(JSON.stringify(snapshot)), ...snapshot };
    },
  };
}

export async function readCanonicalSource(source: Source) {
  if (!source.markdownPath || !source.contentHash) {
    throw new Error("No saved source body");
  }
  const saved = await readFile(source.markdownPath, "utf8");
  const end = saved.indexOf("\n---\n", 4);
  if (!saved.startsWith("---\n") || end < 0) {
    throw new Error("Invalid source artifact");
  }
  const body = saved.slice(end + 5);
  if (hash(body) !== source.contentHash) {
    throw new Error("Source body hash mismatch");
  }
  return body;
}

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Mastra } from "@mastra/core/mastra";
import type { DatasetItemPayload } from "@mastra/core/storage";
import type { EvalCase, EvalSuite } from "./fixtures";
import type { EvalGroup } from "./selection";

// Increase this version when rules outside the hashed files change.
export const EVAL_SCORER_VERSION = "2";

/** Hash all fixture files and main rules, including whitespace changes. */
export function evalFileHash(
  directory = fileURLToPath(new URL("./", import.meta.url)),
) {
  const files = [
    "main.ts",
    ...readdirSync(join(directory, "cases"), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((name) => /\.(json|md)$/.test(name))
      .map((name) => join("cases", name)),
    ...readdirSync(join(directory, "main"), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => join("main", name)),
  ].sort((a, b) => a.localeCompare(b));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(
      JSON.stringify([file, readFileSync(join(directory, file), "utf8")]),
    );
  }
  return hash.digest("hex");
}

export function evalDataset(
  suite: EvalSuite,
  cases: EvalCase[],
  group: EvalGroup,
  repeat: number,
  scorerVersion = EVAL_SCORER_VERSION,
  fileHash = evalFileHash(),
) {
  const items: DatasetItemPayload[] = [...cases]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((item) => {
      const { expectations, ...fixture } = item;
      return Array.from({ length: repeat }, (_, i) => ({
        externalId: `${item.id}/${i + 1}`,
        input: {
          caseId: item.id,
          repetition: i + 1,
          fixture,
          todayUtc: item.todayUtc ?? suite.todayUtc,
          terms: suite.terms,
          provenance: item.provenance ?? suite.provenance,
        },
        groundTruth: expectations,
        metadata: {
          group,
          suite: item.suite,
          origin: item.origin,
          task: item.task,
          locationGroup: item.location?.group ?? null,
        },
      }));
    });
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        fileHash,
        group,
        repeat,
        scorerVersion,
        caseIds: cases
          .map((item) => item.id)
          .sort((a, b) => a.localeCompare(b)),
      }),
    )
    .digest("hex");
  return {
    id: `ingestion-${group.replaceAll("/", "-")}-${revision}`,
    revision,
    group,
    // Native storage rejects undefined optional fields.
    items: JSON.parse(JSON.stringify(items)) as DatasetItemPayload[],
    metadata: { revision, group, repeat, scorerVersion, fileHash },
  };
}

/** Files own the dataset. Reuse its ID without checking stored items. */
export async function prepareEvalDataset(
  mastra: Mastra,
  definition: ReturnType<typeof evalDataset>,
) {
  const store = await mastra.getStorage()!.getStore("datasets");
  const existing = await store!.getDatasetById({ id: definition.id });
  const dataset = existing
    ? await mastra.datasets.get({ id: definition.id })
    : await mastra.datasets.create({
        id: definition.id,
        name: `Ingestion ${definition.group} ${definition.revision.slice(0, 12)}`,
        metadata: definition.metadata,
      });
  if (!existing) {
    await dataset.addItems({ items: definition.items });
  }
  const details = await dataset.getDetails();
  return { dataset, version: details.version, definition };
}

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import type { Mastra } from "@mastra/core/mastra";
import type { DatasetItem, DatasetItemPayload } from "@mastra/core/storage";
import type { EvalCase, EvalSuite } from "./fixtures";
import type { EvalGroup } from "./selection";

// Change this version when a scoring rule changes.
export const EVAL_SCORER_VERSION = "2";

/** Keep the exact expected values and shared rules with each main dataset. */
export function mainEvaluatorSources() {
  const directory = new URL("./main/", import.meta.url);
  return Object.fromEntries([
    ["main.ts", readFileSync(new URL("./main.ts", import.meta.url), "utf8")],
    ...readdirSync(directory)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => [
        `main/${name}`,
        readFileSync(new URL(name, directory), "utf8"),
      ]),
  ]);
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  const clean = JSON.parse(JSON.stringify(value));
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(sort);
    }
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, sort(child)]),
      );
    }
    return item;
  };
  return JSON.stringify(sort(clean));
}

export function evalDataset(
  suite: EvalSuite,
  cases: EvalCase[],
  group: EvalGroup,
  repeat: number,
  scorerVersion = EVAL_SCORER_VERSION,
  evaluatorSources?: Record<string, string>,
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
  const resolvedItems: DatasetItemPayload[] = JSON.parse(canonicalJson(items));
  const rules =
    group === "main/pipeline"
      ? { evaluatorSources: evaluatorSources ?? mainEvaluatorSources() }
      : {};
  const revision = createHash("sha256")
    .update(
      canonicalJson({
        group,
        repeat,
        scorerVersion,
        ...rules,
        items: resolvedItems,
      }),
    )
    .digest("hex");
  return {
    id: `ingestion-${group.replaceAll("/", "-")}-${revision}`,
    revision,
    group,
    items: resolvedItems,
    metadata: { revision, group, repeat, scorerVersion, ...rules },
  };
}

/** Files own the dataset. Verify the current snapshot, then pin its version. */
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
  const items: DatasetItem[] = [];
  for (let page = 0; ; page++) {
    const result = await store!.listItems({
      datasetId: definition.id,
      version: details.version,
      pagination: { page, perPage: 100 },
    });
    items.push(...result.items);
    if (!result.pagination.hasMore) {
      break;
    }
  }
  const payload = (item: DatasetItem) => ({
    externalId: item.externalId,
    input: item.input,
    groundTruth: item.groundTruth,
    metadata: item.metadata,
  });
  const sorted = <T extends { externalId?: string | null }>(values: T[]) =>
    values.toSorted((a, b) =>
      (a.externalId ?? "").localeCompare(b.externalId ?? ""),
    );
  if (
    Object.entries(definition.metadata).some(
      ([key, value]) =>
        canonicalJson(details.metadata?.[key]) !== canonicalJson(value),
    ) ||
    canonicalJson(sorted(items.map(payload))) !==
      canonicalJson(sorted([...definition.items]))
  ) {
    throw new Error(
      `Stored eval dataset differs from repository files: ${definition.id}`,
    );
  }
  return { dataset, version: details.version, items, definition };
}

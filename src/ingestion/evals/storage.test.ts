import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { createScorer, notScorable } from "@mastra/core/evals";
import { createEvalStore, evalDatabasePath } from "./storage";

test("native experiments retain results, numeric scores and errors after restart without touching the catalog", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-evals-"));
  const env = {
    NODE_ENV: "test" as const,
    DATABASE_PATH: join(dir, "catalog.sqlite"),
    CATALOG_EVAL_DATABASE_PATH: join(dir, "evals.sqlite"),
  };
  writeFileSync(env.DATABASE_PATH, "catalog sentinel");
  const store = await createEvalStore(env);
  let reopened: Awaited<ReturnType<typeof createEvalStore>> | undefined;
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    const dataset = await mastra.datasets.create({ name: "storage proof" });
    await dataset.addItems({
      items: ["correct", "wrong", "na", "error"].map((value) => ({
        input: { value },
        externalId: value,
      })),
    });
    const scorer = createScorer<{ value: string }, { value: string }>({
      id: "proof",
      description: "Persistence proof",
    })
      .preprocess(({ run }) =>
        run.output.value === "na" ? notScorable("No expected facts") : {},
      )
      .generateScore(({ run }) => (run.output.value === "correct" ? 1 : 0));
    const result = await dataset.startExperiment({
      metadata: {
        model: "fixture",
        runId: "run-proof",
        traceId: "trace-proof",
      },
      scorers: [scorer],
      task: async ({ input }) => {
        const value = (input as { value: string }).value;
        if (value === "error") {
          throw new Error("Expected task failure");
        }
        return { value };
      },
    });
    expect(
      result.results.find(
        (row) => (row.input as { value: string }).value === "na",
      )?.scores[0].notScorable,
    ).toBeTruthy();
    expect(result.failedCount).toBe(1);
    await store.close();
    reopened = await createEvalStore(env);
    await reopened.init();
    const reader = new Mastra({ storage: reopened, logger: false });
    const saved = await reader.datasets.get({ id: dataset.id });
    expect(
      (await saved.getExperiment({ experimentId: result.experimentId }))
        ?.metadata,
    ).toMatchObject({ runId: "run-proof", traceId: "trace-proof" });
    const rows = await saved.listExperimentResults({
      experimentId: result.experimentId,
    });
    expect(rows.results).toHaveLength(4);
    expect(rows.results.filter((row) => row.error)).toHaveLength(1);
    const scores = await (await reopened.getStore("scores"))!.listScoresByRunId(
      { runId: result.experimentId, pagination: { page: 0, perPage: 100 } },
    );
    expect(scores.scores.map((row) => row.score).sort()).toEqual([0, 1]);
    expect(readFileSync(env.DATABASE_PATH, "utf8")).toBe("catalog sentinel");
    expect(() =>
      evalDatabasePath({
        ...env,
        CATALOG_EVAL_DATABASE_PATH: env.DATABASE_PATH,
      }),
    ).toThrow("separate");
    for (const field of [
      "CATALOG_WORKFLOW_DATABASE_PATH",
      "CATALOG_CHAT_DATABASE_PATH",
    ]) {
      expect(() =>
        evalDatabasePath({ ...env, [field]: env.CATALOG_EVAL_DATABASE_PATH }),
      ).toThrow("separate");
    }
  } finally {
    await reopened?.close();
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Studio composes saved eval domains with workflow history and observability", async () => {
  const { createStudioStorage } = await import("./storage");
  const dir = mkdtempSync(join(tmpdir(), "eventroam-studio-evals-"));
  const stores = await createStudioStorage({
    NODE_ENV: "test",
    CATALOG_EVAL_DATABASE_PATH: join(dir, "evals.sqlite"),
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(dir, "observations.duckdb"),
    CATALOG_WORKFLOW_DATABASE_PATH: join(dir, "workflows.sqlite"),
  });
  try {
    await stores.storage.init();
    expect(await stores.storage.getStore("observability")).toBe(
      await stores.observations.getStore("observability"),
    );
    expect(await stores.storage.getStore("workflows")).toBe(
      await stores.workflows.getStore("workflows"),
    );
    for (const domain of ["datasets", "experiments", "scores"] as const) {
      expect(await stores.storage.getStore(domain)).toBe(
        await stores.evals.getStore(domain),
      );
    }
    const mastra = new Mastra({ storage: stores.storage, logger: false });
    const dataset = await mastra.datasets.create({ name: "Studio proof" });
    expect((await dataset.getDetails()).name).toBe("Studio proof");
  } finally {
    await stores.storage.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

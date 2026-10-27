import { Mastra } from "@mastra/core/mastra";
import { createEvalStore } from "@/ingestion/evals/storage";

/** Reopen native storage, as Studio does after the eval process exits. */
export async function readSavedResults(group: {
  datasetId: string;
  experimentId: string;
  results: { itemId: string }[];
}) {
  const store = await createEvalStore();
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    const dataset = await mastra.datasets.get({ id: group.datasetId });
    const experiment = await dataset.getExperiment({
      experimentId: group.experimentId,
    });
    const rows = await dataset.listExperimentResults({
      experimentId: group.experimentId,
      page: 0,
      perPage: 100,
    });
    const scores = await (await store.getStore("scores"))!.listScoresByRunId({
      runId: group.experimentId,
      pagination: { page: 0, perPage: 100 },
    });
    return { experiment, results: rows.results, scores: scores.scores };
  } finally {
    await store.close();
  }
}

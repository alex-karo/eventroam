import { DuckDBStore } from "@mastra/duckdb";
export async function readTraceRows(path: string) {
  const storage = new DuckDBStore({ path });
  await storage.init();
  try {
    const domain = (await storage.getStore("observability"))!;
    const traces = await domain.listTraces({
      pagination: { page: 0, perPage: 100 },
    });
    const spans = (
      await Promise.all(
        traces.spans.map((span) => domain.getTrace({ traceId: span.traceId })),
      )
    ).flatMap((trace) => trace?.spans ?? []);
    const logs = await domain.listLogs({
      pagination: { page: 0, perPage: 100 },
    });
    const metrics = [];
    let page = 0;
    while (true) {
      const result = await domain.listMetrics({
        pagination: { page, perPage: 100 },
      });
      metrics.push(...result.metrics);
      if (!result.pagination?.hasMore) {
        break;
      }
      page += 1;
    }
    return {
      mastra_ai_spans: spans.map((span) =>
        Object.fromEntries(
          Object.entries(span).map(([key, value]) => [
            key,
            value &&
            ["metadata", "attributes", "input", "output", "error"].includes(key)
              ? JSON.stringify(value)
              : value,
          ]),
        ),
      ),
      mastra_logs: logs.logs,
      mastra_metrics: metrics,
    };
  } finally {
    await storage.close();
  }
}
if (process.argv[1]?.endsWith("/read-observability.ts")) {
  readTraceRows(process.argv[2]).then((rows) =>
    process.stdout.write(JSON.stringify(rows)),
  );
}

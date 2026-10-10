import { DuckDBStore } from "@mastra/duckdb";
async function main() {
  const storage = new DuckDBStore({ path: process.argv[2] });
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
    process.stdout.write(
      JSON.stringify({
        mastra_ai_spans: spans.map((span) =>
          Object.fromEntries(
            Object.entries(span).map(([key, value]) => [
              key,
              value &&
              ["metadata", "attributes", "input", "output", "error"].includes(
                key,
              )
                ? JSON.stringify(value)
                : value,
            ]),
          ),
        ),
        mastra_logs: logs.logs,
      }),
    );
  } finally {
    await storage.close();
  }
}
void main();

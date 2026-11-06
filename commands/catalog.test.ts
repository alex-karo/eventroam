import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";
import { text } from "node:stream/consumers";
import { expect, test, vi } from "vitest";
import { executeCatalogCommand } from "./catalog";

async function localServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const server = createServer(handler).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("sends one fresh run per target and never retries an unknown outcome", async () => {
  const requests: { runId: string | null; input: unknown }[] = [];
  const studio = await localServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const body = JSON.parse(await text(req));
    const runId = url.searchParams.get("runId");
    requests.push({ runId, input: body.inputData });
    expect(url.pathname).toBe("/api/workflows/catalog-ingestion/start-async");
    expect(req.method).toBe("POST");
    if (requests.length === 1) {
      res.destroy();
    } else {
      res.end(
        JSON.stringify({
          status: "failed",
          error: { message: "PRIVATE_PROVIDER_PAYLOAD" },
        }),
      );
    }
  });
  const stdout = vi.fn();
  const stderr = vi.fn();
  try {
    expect(
      await executeCatalogCommand(
        [
          "refresh",
          "--event",
          "a",
          "--event",
          "b",
          "--event",
          "a",
          "--scope",
          "current",
          "--apply",
          "--republish",
          "--json",
          "--url",
          studio.url,
        ],
        { stdout, stderr },
      ),
    ).toBe(1);
    expect(requests).toEqual(
      ["a", "b"].map((eventId) => ({
        runId: expect.any(String),
        input: {
          mode: "refresh",
          input: { eventId, scope: "current" },
          dryRun: false,
          republish: true,
        },
      })),
    );
    expect(requests[0].runId).not.toBe(requests[1].runId);
    const output = stdout.mock.calls[0][0];
    expect(JSON.parse(output)).toEqual({
      dryRun: false,
      results: [],
      failures: [
        {
          eventId: "a",
          engineRunId: requests[0].runId,
          code: "studio_outcome_unknown",
        },
        {
          eventId: "b",
          engineRunId: requests[1].runId,
          code: "workflow_failed",
        },
      ],
    });
    expect(output).not.toContain("PRIVATE_PROVIDER_PAYLOAD");
  } finally {
    await studio.close();
  }
});

test("a stopped Studio yields a bounded error with the startup command", async () => {
  const studio = await localServer(() => {});
  await studio.close();
  const stdout = vi.fn();
  const stderr = vi.fn();
  expect(
    await executeCatalogCommand(
      ["refresh", "--event", "a", "--url", studio.url],
      { stdout, stderr },
    ),
  ).toBe(1);
  expect(stdout).toHaveBeenCalledWith(
    expect.stringContaining("studio_unreachable"),
  );
  expect(stderr).toHaveBeenCalledWith(
    expect.stringContaining("pnpm run catalog:studio"),
  );
});

test("sends the full add note and reports a history storage failure safely", async () => {
  const note = "52.1, 10.2\nhttps://example.com/festival";
  const studio = await localServer(async (req, res) => {
    expect(JSON.parse(await text(req))).toEqual({
      inputData: { mode: "add", input: note, dryRun: true, republish: false },
    });
    res.writeHead(500);
    res.end(JSON.stringify({ error: "workflow_history_failed" }));
  });
  const stdout = vi.fn();
  try {
    expect(
      await executeCatalogCommand(
        ["add", "--input", note, "--json", "--url", studio.url],
        { stdout, stderr: vi.fn() },
      ),
    ).toBe(1);
    expect(JSON.parse(stdout.mock.calls[0][0]).failures).toEqual([
      { engineRunId: expect.any(String), code: "workflow_history_failed" },
    ]);
  } finally {
    await studio.close();
  }
});

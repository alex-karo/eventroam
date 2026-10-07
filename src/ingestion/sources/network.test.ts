import http from "node:http";
import net from "node:net";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createResearchBudget, ResearchLimitError } from "../runtime/budget";
import {
  getBoundedResponse,
  UnsafeSourceError,
  type LookupHost,
} from "./network";
import { readSource } from "./read-source";

const publicAddress = { address: "8.8.8.8", family: 4 };
const resolver = vi.fn<LookupHost>(async () => [publicAddress]);
const requests: string[] = [];
let respond: http.RequestListener;
const server = http.createServer((request, response) => {
  requests.push(`${request.headers.host}${request.url}`);
  respond(request, response);
});
let restoreTransport: () => void;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  // Redirect sockets to our fixture only; exercise real Got and verify its pinned lookup.
  const transport = vi
    .spyOn(http.globalAgent, "createConnection")
    .mockImplementation((options) => {
      options.lookup!(options.host!, { all: true }, (error, addresses) => {
        expect(error).toBeNull();
        expect(addresses).toEqual([publicAddress]);
      });
      return net.connect({ host: "127.0.0.1", port });
    });
  restoreTransport = () => transport.mockRestore();
});

afterAll(async () => {
  restoreTransport();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests.length = 0;
  resolver.mockReset().mockResolvedValue([publicAddress]);
  respond = (_request, response) => {
    response.writeHead(200, {
      "content-type": "text/plain",
      connection: "close",
    });
    response.end("Festival 2027 confirmed");
  };
});

const load = (
  options: Partial<Parameters<typeof getBoundedResponse>[1]> = {},
) =>
  getBoundedResponse("http://fixture.example/start", {
    maxBytes: 100,
    timeoutMs: 5_000,
    resolver,
    ...options,
  });

it("follows redirects with one checked, pinned DNS lookup per hop", async () => {
  respond = (request, response) => {
    if (request.url === "/start") {
      response.writeHead(302, { location: "http://next.example/end" });
    } else {
      response.writeHead(200, { "content-type": "text/plain" });
    }
    response.end("Festival");
  };
  expect(await load()).toMatchObject({
    finalUrl: "http://next.example/end",
    status: 200,
    body: Buffer.from("Festival"),
  });
  expect(resolver.mock.calls.map(([host]) => host)).toEqual([
    "fixture.example",
    "next.example",
  ]);
  expect(requests).toHaveLength(2);
});

it("blocks redirected private DNS addresses before connecting", async () => {
  resolver
    .mockResolvedValueOnce([publicAddress])
    .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
  respond = (_request, response) => {
    response.writeHead(302, { location: "http://next.example/end" });
    response.end();
  };
  await expect(load()).rejects.toBeInstanceOf(UnsafeSourceError);
  expect(requests).toHaveLength(1);
});

it.each(["http://127.0.0.1/private", "http://user:password@next.example/end"])(
  "blocks unsafe redirect %s",
  async (location) => {
    respond = (_request, response) => {
      response.writeHead(302, { location });
      response.end();
    };
    await expect(load()).rejects.toBeInstanceOf(UnsafeSourceError);
    expect(requests).toHaveLength(1);
  },
);

it("preserves redirect limit and missing-location errors", async () => {
  respond = (_request, response) => {
    response.writeHead(302, { location: "/start" });
    response.end();
  };
  await expect(load({ maxRedirects: 1 })).rejects.toThrow("redirect_limit");
  expect(requests).toHaveLength(2);
  respond = (_request, response) => {
    response.writeHead(302);
    response.end();
  };
  await expect(load()).rejects.toThrow("redirect_without_location");
});

it.each([true, false])(
  "bounds response bytes with content-length=%s",
  async (withLength) => {
    respond = (_request, response) => {
      response.writeHead(200, withLength ? { "content-length": "1000" } : {});
      response.write("x".repeat(500));
      response.end("x".repeat(500));
    };
    await expect(load()).rejects.toThrow("oversized_response");
    expect(requests).toHaveLength(1);
  },
);

it("bounds a hanging DNS lookup and a hanging response", async () => {
  await expect(
    load({ timeoutMs: 30, resolver: () => new Promise(() => {}) }),
  ).rejects.toThrow("timeout");
  expect(requests).toHaveLength(0);
  respond = (_request, response) => {
    response.writeHead(200);
    response.flushHeaders();
  };
  await expect(load({ timeoutMs: 30 })).rejects.toThrow("timeout");
  expect(requests).toHaveLength(1);
});

it("retries in Got and charges each retry to the source page budget", async () => {
  respond = (_request, response) => {
    response.writeHead(requests.length === 1 ? 503 : 200, {
      "retry-after": "0",
      "content-type": "text/plain",
    });
    response.end("Festival 2027 confirmed");
  };
  const budget = createResearchBudget({ pages: 2 });
  const result = await readSource("http://fixture.example/start", {
    budget,
    resolver,
  });
  expect(result.outcome).toBe("ok");
  expect(requests).toHaveLength(2);
  expect(budget.snapshot().pages).toBe(2);
  expect(resolver).toHaveBeenCalledTimes(2);
});

it("stops retries before a request when the page budget is exhausted", async () => {
  respond = (_request, response) => {
    response.writeHead(503, { "retry-after": "0" });
    response.end();
  };
  const budget = createResearchBudget({ pages: 1 });
  expect(
    await readSource("http://fixture.example/start", { budget, resolver }),
  ).toMatchObject({ outcome: "blocked", reason: "pages_budget_exhausted" });
  expect(requests).toHaveLength(1);
  expect(budget.snapshot().pages).toBe(1);
});

it("preserves callback errors and checks DNS afresh on retry", async () => {
  respond = (_request, response) => {
    response.writeHead(503, { "retry-after": "0" });
    response.end();
  };
  const failure = new ResearchLimitError("pages");
  await expect(
    load({
      onRetry: () => {
        throw failure;
      },
    }),
  ).rejects.toBe(failure);
  resolver
    .mockResolvedValueOnce([publicAddress])
    .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
  await expect(load()).rejects.toBeInstanceOf(UnsafeSourceError);
  expect(requests).toHaveLength(2);
});

it("returns the final HTTP status after two retries, without retrying 403", async () => {
  respond = (_request, response) => {
    response.writeHead(503, { "retry-after": "0" });
    response.end("unavailable");
  };
  expect((await load()).status).toBe(503);
  expect(requests).toHaveLength(3);
  respond = (_request, response) => {
    response.writeHead(403);
    response.end();
  };
  expect((await load()).status).toBe(403);
  expect(requests).toHaveLength(4);
});

it("includes retry delays in the total deadline", async () => {
  respond = (_request, response) => {
    response.writeHead(503);
    response.end();
  };
  await expect(load({ timeoutMs: 40 })).rejects.toThrow("timeout");
  expect(requests).toHaveLength(1);
});

it("retries a disconnected redirect response through Got", async () => {
  respond = (_request, response) => {
    if (requests.length === 1) {
      response.writeHead(302, { location: "/end", "content-length": "10" });
      response.write("x");
      setTimeout(() => response.destroy(), 10);
    } else {
      response.end("Festival");
    }
  };
  const onRetry = vi.fn();
  expect((await load({ onRetry })).body.toString()).toBe("Festival");
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(requests).toHaveLength(2);
});

it.each([true, false])(
  "bounds intermediate redirect bodies with content-length=%s",
  async (withLength) => {
    respond = (_request, response) => {
      response.writeHead(302, {
        location: "/end",
        ...(withLength ? { "content-length": "1000" } : {}),
      });
      response.write("x".repeat(500));
      response.end("x".repeat(500));
    };
    await expect(load()).rejects.toThrow("oversized_response");
    expect(requests).toHaveLength(1);
  },
);

it("closes an endless intermediate response at the deadline", async () => {
  let closed: Promise<void> | undefined;
  respond = (_request, response) => {
    closed = new Promise((resolve) => response.on("close", resolve));
    response.writeHead(302, { location: "/end" });
    response.flushHeaders();
  };
  await expect(load({ timeoutMs: 50 })).rejects.toThrow("timeout");
  await closed;
  expect(requests).toHaveLength(1);
});

it.each([
  { location: "/end", maxRedirects: 0, error: "redirect_limit" },
  { location: "file:///private", maxRedirects: 5, error: "unsafe_url" },
])(
  "closes redirect errors before reading their bodies: $error",
  async (test) => {
    let closed: Promise<void> | undefined;
    respond = (_request, response) => {
      closed = new Promise((resolve) => response.on("close", resolve));
      response.writeHead(302, { location: test.location });
      response.write("x".repeat(1000));
      // Deliberately never end: Got must neither buffer nor wait for this body.
    };
    await expect(
      load({ maxRedirects: test.maxRedirects, timeoutMs: 500 }),
    ).rejects.toThrow(test.error);
    await closed;
    expect(requests).toHaveLength(1);
  },
);

import { expect, it, vi } from "vitest";
import { getFirecrawlResponse } from "./firecrawl";

const target = "https://festival.example/2027";
const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
const options = {
  apiKey: "test-secret",
  maxBytes: 2048,
  timeoutMs: 1000,
  resolver,
};

function document(metadata = { statusCode: 200, url: `${target}/programme` }) {
  return {
    success: true,
    data: { rawHtml: "<p>Festival dates</p>", metadata },
  };
}

it("requests fresh raw HTML with authentication and returns the source status and URL", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(document()));
  const response = await getFirecrawlResponse(target, { ...options, request });
  const [url, init] = request.mock.calls[0];
  expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
  expect(init).toMatchObject({
    method: "POST",
    redirect: "error",
    headers: { authorization: "Bearer test-secret" },
  });
  expect(JSON.parse(init!.body as string)).toEqual({
    url: target,
    formats: ["rawHtml"],
    onlyMainContent: false,
    maxAge: 0,
    timeout: 1000,
    proxy: "auto",
    skipTlsVerification: false,
  });
  expect(response).toEqual({
    finalUrl: `${target}/programme`,
    status: 200,
    contentType: "text/html",
    body: Buffer.from("<p>Festival dates</p>"),
  });
});

it("does not treat a successful API request as a successful source HTTP status", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(document({ statusCode: 403, url: target })),
    );
  expect(
    (await getFirecrawlResponse(target, { ...options, request })).status,
  ).toBe(403);
});

it.each([401, 402, 429, 500])(
  "reports API HTTP %i without leaking its body or retrying",
  async (status) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("test-secret", { status }));
    await expect(
      getFirecrawlResponse(target, { ...options, request }),
    ).rejects.toThrow(`firecrawl_http_${status}`);
    expect(request).toHaveBeenCalledOnce();
  },
);

it.each([
  "not json",
  JSON.stringify({ success: false, error: "test-secret" }),
  JSON.stringify({ success: true, data: {} }),
])("rejects invalid API output safely: %s", async (body) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
  await expect(
    getFirecrawlResponse(target, { ...options, request }),
  ).rejects.toThrow("firecrawl_invalid_response");
});

it("bounds streamed API output even without content-length", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("x".repeat(2049)));
  await expect(
    getFirecrawlResponse(target, { ...options, request }),
  ).rejects.toThrow("oversized_response");
});

it("checks content-length before reading output", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response("small", { headers: { "content-length": "2049" } }),
    );
  await expect(
    getFirecrawlResponse(target, { ...options, request }),
  ).rejects.toThrow("oversized_response");
});

it("blocks private targets before contacting the API", async () => {
  const request = vi.fn<typeof fetch>();
  await expect(
    getFirecrawlResponse("http://127.0.0.1", { ...options, request }),
  ).rejects.toThrow("unsafe_address");
  expect(request).not.toHaveBeenCalled();
});

it("rejects unsafe final source URLs", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        document({ statusCode: 200, url: "http://127.0.0.1/secret" }),
      ),
    );
  await expect(
    getFirecrawlResponse(target, { ...options, request }),
  ).rejects.toThrow("unsafe_address");
});

it("aborts the API request when its time limit expires", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 2_000);
        init!.signal!.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(init!.signal!.reason);
          },
          { once: true },
        );
      });
      return Response.json(document());
    });
  await expect(
    getFirecrawlResponse(target, { ...options, request }),
  ).rejects.toThrow("timeout");
  expect(request).toHaveBeenCalledOnce();
});

it.each(["initial", "final"])(
  "bounds a hanging %s DNS lookup by the request deadline",
  async (stage) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(document()));
    const hangingLookup = vi.fn<NonNullable<typeof options.resolver>>();
    if (stage === "final") {
      hangingLookup.mockResolvedValueOnce([
        { address: "93.184.216.34", family: 4 },
      ]);
    }
    hangingLookup.mockImplementation(() => new Promise(() => {}));
    await expect(
      getFirecrawlResponse(target, {
        ...options,
        request,
        resolver: hangingLookup,
      }),
    ).rejects.toThrow("timeout");
    expect(request).toHaveBeenCalledTimes(stage === "initial" ? 0 : 1);
    expect(hangingLookup).toHaveBeenCalledTimes(stage === "initial" ? 1 : 2);
  },
);

it("does not start DNS or an API request when less than one second remains", async () => {
  const request = vi.fn<typeof fetch>();
  const lookup = vi.fn<typeof resolver>();
  await expect(
    getFirecrawlResponse(target, {
      ...options,
      timeoutMs: 999,
      request,
      resolver: lookup,
    }),
  ).rejects.toThrow("timeout");
  expect(lookup).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

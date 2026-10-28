import { expect, test, vi } from "vitest";
import { createResearchBudget } from "../../runtime/budget";
import { type getBoundedResponse } from "../network";
import mountain from "./fixtures/mountain-music.json";
import { readPage } from "./read";
import { boundedToolSource } from "./response";
import { readPageOutputSchema } from "./contracts";

const parent = "https://festival.example/location";
const mapUrl = mountain.sourceUrl;
const body = `<h1>Festival location</h1><p>${"Page evidence. ".repeat(30)}</p>
<iframe src="${mapUrl}"></iframe><a href="${mapUrl.replace("viewer", "edit")}">Parking map</a>`;
const mapBody = `var _pageData = ${JSON.stringify(JSON.stringify(mountain.pageData))};`;
const response = (body: string, finalUrl = parent, status = 200) => ({
  finalUrl,
  status,
  contentType: "text/html",
  body: Buffer.from(body),
});

test("one read exposes map markers through the model projection without map rendering", async () => {
  const budget = createResearchBudget();
  const request = vi.fn<typeof getBoundedResponse>();
  request.mockResolvedValueOnce(response(body));
  request.mockImplementationOnce(async (url, options) => {
    expect(url).toBe(mapUrl);
    expect(options.maxBytes).toBe(budget.limits.pageBytes);
    expect(options.timeoutMs).toBeGreaterThan(0);
    expect(options.timeoutMs).toBeLessThanOrEqual(15_000);
    options.onRetry?.();
    return response(
      mapBody.replace(
        "The festival grounds will cover Buchanan Park.",
        "Details https://festival.example/extra",
      ),
      url,
    );
  });
  const firecrawlRequest = vi.fn();
  const result = await readPage(parent, {
    budget,
    request,
    firecrawlKey: "test-key",
    firecrawlRequest,
  });
  const output = readPageOutputSchema.parse({
    ...boundedToolSource(result),
    remaining: budget.remaining(),
  });
  expect(output.url).toBe(parent);
  expect(output.status).toBe("ok");
  expect(output.markdown).toContain("Page evidence");
  expect(output.markdown).toContain("Venue: Buchanan Park");
  expect(output.markdown).toContain("2024");
  expect(output.markdown).toContain("39.6858145");
  expect(output.markdown).toContain(mapUrl);
  expect(output.markdown).toContain("https://festival.example/extra");
  expect(request).toHaveBeenCalledTimes(2);
  expect(firecrawlRequest).not.toHaveBeenCalled();
  expect(budget.snapshot().pages).toBe(3);
});

test.each([
  new Error("secret error details"),
  response("Forbidden", mapUrl, 403),
  response("Unsupported script data", mapUrl),
  response("x".repeat(20_001), mapUrl),
])(
  "map failures keep parent evidence and report a safe limitation",
  async (failure) => {
    const request = vi.fn<typeof getBoundedResponse>();
    request.mockResolvedValueOnce(response(body));
    if (failure instanceof Error) {
      request.mockRejectedValueOnce(failure);
    } else {
      request.mockResolvedValueOnce(failure);
    }
    const result = await readPage(parent, {
      budget: createResearchBudget({ pageBytes: 20_000 }),
      request,
      firecrawlKey: "",
    });
    expect(result.status).toBe("ok");
    expect(result.reasonCode).toBe("map_read_incomplete");
    expect(result.markdown).toContain("Page evidence");
    expect(result.markdown).toContain(mapUrl);
    expect(result.markdown).toContain("Map read incomplete:");
    expect(result.markdown).toContain("Point data is unverified");
    expect(result.markdown).not.toContain("secret error details");
    expect(result.markdown).not.toContain("No point markers");
  },
);

test("expired shared budget leaves a notice without a map request", async () => {
  let now = 0;
  const budget = createResearchBudget({ durationMs: 1000 }, () => now);
  const request = vi
    .fn<typeof getBoundedResponse>()
    .mockImplementationOnce(async () => {
      now = 1001;
      return response(body);
    });
  const result = await readPage(parent, { budget, request, firecrawlKey: "" });
  expect(request).toHaveBeenCalledOnce();
  expect(result.markdown).toContain("time_budget_exhausted");
  expect(result.reasonCode).toBe("map_read_incomplete");
});

test("ordinary and short Maps references do not trigger another request", async () => {
  const request = vi
    .fn<typeof getBoundedResponse>()
    .mockResolvedValue(
      response(
        '<iframe title="Venue" data-src="https://maps.google.com/maps?q=Venue"></iframe><a href="https://maps.app.goo.gl/example">Bus stop</a>',
      ),
    );
  const result = await readPage(parent, {
    budget: createResearchBudget(),
    request,
    firecrawlKey: "",
  });
  expect(result.markdown).toContain("https://maps.google.com/maps?q=Venue");
  expect(result.markdown).toContain("Bus stop");
  expect(request).toHaveBeenCalledOnce();
});

test("fallback retains direct and rendered map references and reads duplicates once", async () => {
  const second = "https://www.google.com/maps/d/viewer?mid=second";
  const request = vi.fn<typeof getBoundedResponse>();
  request.mockResolvedValueOnce(
    response(`<script>app()</script><iframe src="${mapUrl}"></iframe>`),
  );
  request.mockImplementation(async (url) => response(mapBody, url));
  const firecrawlRequest = vi
    .fn()
    .mockResolvedValue(
      response(
        `<p>${"Rendered page. ".repeat(30)}</p><iframe src="${mapUrl}"></iframe><iframe src="${second}"></iframe>`,
      ),
    );
  const result = await readPage(parent, {
    budget: createResearchBudget(),
    request,
    firecrawlRequest,
    firecrawlKey: "key",
  });
  expect(result.method).toBe("firecrawl");
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    parent,
    mapUrl,
    second,
  ]);
  expect(firecrawlRequest).toHaveBeenCalledOnce();
  expect(result.markdown).toContain(second);
});

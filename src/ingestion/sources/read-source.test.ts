import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { readSource } from "./read-source";
import { assertPublicUrl, isPublicAddress, UnsafeSourceError } from "./network";
import { FirecrawlError } from "./firecrawl";

const sourceUrl = "https://festival.example/2027";

function mockResponse(body: string, contentType = "text/html") {
  return vi.fn(async () => ({
    finalUrl: sourceUrl,
    status: 200,
    contentType,
    body: Buffer.from(body),
  }));
}

describe("readSource", () => {
  beforeEach(() => vi.stubEnv("FIRECRAWL_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("falls back on 403 using the env key, final URL and shared extraction", async () => {
    vi.stubEnv("FIRECRAWL_KEY", "test-key");
    const budget = createResearchBudget();
    const request = mockResponse("Forbidden");
    request.mockResolvedValueOnce({
      finalUrl: "https://festival.example/redirected/",
      status: 403,
      contentType: "text/html",
      body: Buffer.from("Forbidden"),
    });
    const firecrawlRequest = mockResponse(
      '<h1>Festival 2027</h1><p>10–12 June</p><a href="/tickets">Tickets</a><script>secret</script>',
    );
    const log = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    log.child.mockReturnValue(log);
    const result = await readSource(sourceUrl, {
      budget,
      request,
      firecrawlRequest,
      log,
    });
    expect(log.warn).toHaveBeenCalledWith(
      "Blocked source uses Firecrawl fallback",
      expect.objectContaining({
        httpStatus: 403,
        provider: "firecrawl",
        attemptedUrl: "https://festival.example/redirected/",
      }),
    );
    expect(firecrawlRequest).toHaveBeenCalledOnce();
    expect(firecrawlRequest).toHaveBeenCalledWith(
      "https://festival.example/redirected/",
      expect.objectContaining({ apiKey: "test-key", timeoutMs: 30_000 }),
    );
    expect(result).toMatchObject({
      method: "firecrawl",
      attemptedUrl: sourceUrl,
      finalUrl: sourceUrl,
      links: ["https://festival.example/tickets"],
    });
    expect(result.markdown).toContain("Festival 2027");
    expect(result.markdown).not.toContain("secret");
    expect(budget.snapshot().pages).toBe(2);
  });

  it.each([200, 401, 429, 500])(
    "does not fall back on HTTP %i",
    async (status) => {
      const request = mockResponse("<p>Festival dates</p>");
      request.mockResolvedValueOnce({
        finalUrl: sourceUrl,
        status,
        contentType: "text/html",
        body: Buffer.from("<p>Festival dates</p>"),
      });
      const firecrawlRequest = mockResponse("<p>Fallback</p>");
      await readSource(sourceUrl, {
        budget: createResearchBudget(),
        request,
        firecrawlRequest,
        firecrawlKey: "test-key",
      });
      expect(firecrawlRequest).not.toHaveBeenCalled();
    },
  );

  it("keeps 403 blocked without a key", async () => {
    const request = mockResponse("Forbidden");
    request.mockResolvedValueOnce({
      finalUrl: sourceUrl,
      status: 403,
      contentType: "text/html",
      body: Buffer.from("Forbidden"),
    });
    const firecrawlRequest = mockResponse("<p>Fallback</p>");
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
    });
    expect(result).toMatchObject({
      method: "http",
      outcome: "blocked",
      reason: "http_403",
    });
    expect(firecrawlRequest).not.toHaveBeenCalled();
  });

  it("starts fallback after a blocked page without a page cap", async () => {
    const request = mockResponse("Forbidden");
    request.mockResolvedValueOnce({
      finalUrl: sourceUrl,
      status: 403,
      contentType: "text/html",
      body: Buffer.from("Forbidden"),
    });
    const firecrawlRequest = mockResponse("<p>Fallback</p>");
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      outcome: "ok",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
  });

  it("reports fallback failure safely without retrying it", async () => {
    const request = mockResponse("Forbidden");
    request.mockResolvedValueOnce({
      finalUrl: sourceUrl,
      status: 403,
      contentType: "text/html",
      body: Buffer.from("Forbidden"),
    });
    const firecrawlRequest = vi
      .fn()
      .mockRejectedValue(new FirecrawlError("firecrawl_http_402"));
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      method: "firecrawl",
      outcome: "failed",
      reason: "firecrawl_http_402",
      completeness: "none",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
  });

  it("passes ordered headings, programme dates, ticket cards and tables as Markdown", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request:
        mockResponse(`<html><head><title>Festival programme</title></head><body>
        <main><h1>Festival 2027</h1>
          <h2>Programme dates</h2><p>Music: 10–12 June 2027.</p>
          <p>Camping opens 9 June 2027.</p>
          <table><thead><tr><th>Day</th><th>Programme</th></tr></thead>
          <tbody><tr><td>10 June</td><td>Opening concerts</td></tr></tbody></table>
          <h2>Tickets</h2>
          <article><h3>Weekend pass</h3><p>Available now</p><a href="/tickets">Buy pass</a></article>
          <article><h3>Day pass</h3><p>Sold out</p></article>
        </main></body></html>`),
    });
    expect(result.markdown).toMatch(
      /## Programme dates[\s\S]*Music: 10–12 June 2027[\s\S]*Camping opens 9 June 2027/,
    );
    expect(result.markdown).toMatch(/\| Day\s+\| Programme\s+\|/);
    expect(result.markdown).toMatch(
      /## Tickets[\s\S]*### Weekend pass[\s\S]*Available now[\s\S]*### Day pass[\s\S]*Sold out/,
    );
    expect(result.markdown).toContain(
      "[Buy pass](https://festival.example/tickets)",
    );
    expect(result).not.toHaveProperty("blocks");
    expect(result.markdown).not.toMatch(/<!-- b\d+ -->/);
    expect(result.markdown).not.toContain("<article>");
  });

  it("keeps a festival card link in page order, as in captured homepages", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body><section>
        <a href="/winter"><div><img src="/large-poster.jpg" alt="">
          <div><span>MORE</span><p>INFO</p></div></div></a>
        <h2>Tomorrowland Winter</h2><p>20–27 March 2027</p>
        <a href="javascript:alert(1)">Invalid link</a>
      </section></body></html>`),
    });
    expect(result.markdown).toContain(
      "[MORE INFO](https://festival.example/winter)",
    );
    expect(result.markdown).not.toMatch(/<!-- b\d+ -->/);
    expect(result.markdown).not.toContain("large-poster.jpg");
    expect(result.markdown).not.toContain("javascript:");
    expect(result.markdown.indexOf("MORE INFO")).toBeLessThan(
      result.markdown.indexOf("Tomorrowland Winter"),
    );
  });

  it("keeps datetime in linked cards and excludes hidden/script text from their labels", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body>
        <a href="/programme"><article><h2>Festival programme</h2>
          <time datetime="2027-07-20">20 July</time></article></a>
        <a href="/2027"><div>Festival 2027</div>
          <p hidden>Cancelled in 2024</p><script>secret instruction</script></a>
      </body></html>`),
    });
    expect(result.markdown).toContain("2027-07-20");
    expect(result.markdown).not.toContain("Cancelled in 2024");
    expect(result.markdown).not.toContain("secret instruction");
  });

  it("retains long Markdown links when the whole page fits the bound", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body><p>First announcement</p>
        <a href="/tickets?${"x".repeat(2_000)}">Ticket page</a>
        <p>Second announcement</p></body></html>`),
    });
    expect(result.completeness).toBe("full");
    expect(result.reason).toBeUndefined();
    expect(result.markdown).toContain("Second announcement");
    expect(result.markdown).toContain("](https://festival.example/tickets?");
  });

  it("retains ordinary paragraphs longer than the old block limit", async () => {
    const paragraph = `This edition has ${"a detailed programme ".repeat(100)}and more.`;
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body><p>${paragraph}</p></body></html>`),
    });
    expect(result.markdown).toContain(paragraph);
    expect(result.completeness).toBe("full");
  });

  it("bounds total Markdown at a natural boundary and marks the read partial", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `${"Festival programme details. ".repeat(3_200)}\n\nLater announcement`,
        "text/plain",
      ),
    });
    expect(result.markdown.length).toBeLessThanOrEqual(20_000);
    expect(result.markdown.endsWith(".")).toBe(true);
    expect(result.markdown).not.toContain("Later announcement");
    expect(result).toMatchObject({
      outcome: "ok",
      completeness: "partial",
      reason: "source_content_truncated",
    });
  });

  it("does not cut a Markdown link when it crosses the total bound", async () => {
    const prefix = `${"Programme. ".repeat(7_000)} `;
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `<html><body><p>${prefix}<a href="/tickets?${"x".repeat(8_000)}">Tickets</a></p></body></html>`,
      ),
    });
    expect(result.markdown).toContain("Programme.");
    expect(result.markdown).not.toContain("[Tickets](");
    expect(result.markdown).not.toContain("/tickets?");
    expect(result).toMatchObject({
      completeness: "partial",
      reason: "source_content_truncated",
    });
  });

  it("extracts continuous text, structured event data, timestamps and ticket links", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      now: () => new Date("2026-10-03T12:00:00Z"),
      request: mockResponse(`
        <html><head><title>Festival 2027</title>
        <script type="application/ld+json">{"@type":"MusicEvent","name":"Festival 2027","startDate":"2027-06-10"}</script>
        </head><body><main><h1>Festival 2027</h1><p>June 10 to 12 in Porto.</p>
        <time datetime="2027-06-10">Thursday</time>
        <a href="/tickets">Tickets for 2027</a></main></body></html>`),
    });
    expect(result).toMatchObject({
      attemptedUrl: sourceUrl,
      finalUrl: sourceUrl,
      retrievedAt: "2026-10-03T12:00:00.000Z",
      method: "http",
      outcome: "ok",
      completeness: "full",
    });
    expect(result).not.toHaveProperty("blocks");
    expect(result.markdown).toContain("startDate: 2027-06-10");
    expect(result.markdown).toContain("Thursday: 2027-06-10");
    expect(result.links).toContain("https://festival.example/tickets");
  });

  it("keeps a date shown only in a header anchor and organizer text in the footer", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body>
        <header><nav><a href="/2027"><span>7TH-10TH</span><span>JULY2027</span></a></nav></header>
        <main><p>Join the festival in 2027.</p></main>
        <footer><div><span>Organised by Example Events Ltd</span></div></footer>
      </body></html>`),
    });
    expect(result.outcome).toBe("ok");
    expect(result.markdown).toContain("7TH-10THJULY2027");
    expect(result.markdown).toContain("Organised by Example Events Ltd");
  });

  it("traverses JSON-LD graph nodes for edition facts and organizer identity", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "MusicEvent",
              name: "Festival 2027",
              startDate: "2027-07-07",
              organizer: {
                "@type": "Organization",
                name: "Example Events Ltd",
              },
            },
          ],
        }),
        "application/ld+json",
      ),
    });
    expect(result.markdown).toContain("startDate: 2027-07-07");
    expect(result.markdown).toContain("Example Events Ltd");
  });

  it("keeps JSON-LD location and organizer properties under distinct paths", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        JSON.stringify({
          "@type": "MusicEvent",
          name: "Festival 2027",
          location: { address: { addressCountry: "PT" } },
          organizer: { name: "Example Ltd", address: { addressCountry: "GB" } },
        }),
        "application/ld+json",
      ),
    });
    expect(result.markdown).toContain("location.address: addressCountry: PT");
    expect(result.markdown).toContain("organizer.address: addressCountry: GB");
  });

  it("preserves social URLs without claiming their content was read", async () => {
    const request = mockResponse("should never be fetched");
    const result = await readSource("https://www.instagram.com/festival/", {
      budget: createResearchBudget(),
      request,
    });
    expect(result).toMatchObject({
      method: "social_stub",
      outcome: "unsupported",
      reason: "social_content_unsupported",
      completeness: "none",
    });
    expect(result.links[0]).toBe("https://www.instagram.com/festival/");
    expect(request).not.toHaveBeenCalled();
  });

  it("reports sparse JavaScript pages as partial without executing scripts", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        "<html><body><main>Loading festival details</main><script src='/app.js'></script></body></html>",
      ),
    });
    expect(result).toMatchObject({
      method: "http",
      outcome: "partial",
      completeness: "partial",
      reason: "javascript_required",
    });
    expect(result.markdown).toContain("Loading festival details");
  });

  it("ignores long navigation when assessing a JavaScript page", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `<html><body><header><nav>${"Festival navigation ".repeat(30)}</nav></header><main id="root"></main><script src="/app.js"></script></body></html>`,
      ),
    });
    expect(result).toMatchObject({
      method: "http",
      outcome: "partial",
      completeness: "partial",
      reason: "javascript_required",
    });
  });

  it("rejects oversized and unsupported responses", async () => {
    const oversized = await readSource(sourceUrl, {
      budget: createResearchBudget({ pageBytes: 2 }),
      request: mockResponse("too large"),
    });
    expect(oversized.reason).toBe("oversized_response");
    const pdf = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse("%PDF", "application/pdf"),
    });
    expect(pdf.outcome).toBe("unsupported");
  });

  it("returns a safe reason without exposing a URL in a network error", async () => {
    const result = await readSource(sourceUrl, {
      budget: createResearchBudget(),
      request: vi
        .fn()
        .mockRejectedValue(
          new Error("failure at https://secret.example/?token=private"),
        ),
    });
    expect(result.reason).toBe("request_failed");
  });
});

describe("public source addresses", () => {
  it("rejects private, loopback, mapped and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.1.1",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "0:0:0:0:0:0:0:1",
      "fc00::1",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:7f00:1",
      "2001:db8::1",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects a private source address", async () => {
    await expect(
      assertPublicUrl("https://source.example/", async () => [
        { address: "10.0.0.2", family: 4 },
      ]),
    ).rejects.toBeInstanceOf(UnsafeSourceError);
  });
});

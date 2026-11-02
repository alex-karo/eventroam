import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResearchBudget } from "../../runtime/budget";
import { readPage } from "./read";
import { extractSource } from "./extract";
import { createSourceSession } from "../session";
import { createReadPageTool } from "./tool";
import { boundedToolSource } from "./response";
import {
  assertPublicUrl,
  isPublicAddress,
  UnsafeSourceError,
} from "../network";
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

describe("readPage", () => {
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
    const result = await readPage(sourceUrl, {
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
      await readPage(sourceUrl, {
        budget: createResearchBudget(),
        request,
        firecrawlRequest,
        firecrawlKey: "test-key",
      });
      expect(firecrawlRequest).not.toHaveBeenCalled();
    },
  );

  it("reports 403 as failed without a key", async () => {
    const request = mockResponse("Forbidden");
    request.mockResolvedValueOnce({
      finalUrl: sourceUrl,
      status: 403,
      contentType: "text/html",
      body: Buffer.from("Forbidden"),
    });
    const firecrawlRequest = mockResponse("<p>Fallback</p>");
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
    });
    expect(result).toMatchObject({
      method: "http",
      status: "failed",
      reasonCode: "http_403",
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
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      status: "ok",
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
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request,
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      method: "firecrawl",
      status: "failed",
      reasonCode: "firecrawl_http_402",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
  });

  it("passes ordered headings, programme dates, ticket cards and tables as Markdown", async () => {
    const result = await readPage(sourceUrl, {
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
    const result = await readPage(sourceUrl, {
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
    const result = await readPage(sourceUrl, {
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
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body><p>First announcement</p>
        <a href="/tickets?${"x".repeat(2_000)}">Ticket page</a>
        <p>Second announcement</p></body></html>`),
    });
    expect(result.reasonCode).toBeUndefined();
    expect(result.markdown).toContain("Second announcement");
    expect(result.markdown).toContain("](https://festival.example/tickets?");
  });

  it("retains ordinary paragraphs longer than the old block limit", async () => {
    const paragraph = `This edition has ${"a detailed programme ".repeat(100)}and more.`;
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body><p>${paragraph}</p></body></html>`),
    });
    expect(result.markdown).toContain(paragraph);
  });

  it("keeps full Markdown and bounds only the model projection", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `${"Festival programme details. ".repeat(3_200)}\n\nLater announcement`,
        "text/plain",
      ),
    });
    expect(result.markdown.length).toBeGreaterThan(80_000);
    expect(result.markdown).toContain("Later announcement");
    const projected = boundedToolSource(result);
    expect(projected.markdown.length).toBeLessThanOrEqual(79_700);
    expect(projected.markdown).toMatch(/(?:Festival|programme|details\.)$/);
    expect(projected.markdown).not.toContain("Later announcement");
    expect(projected).toMatchObject({ status: "ok", truncated: true });
    expect(projected).not.toHaveProperty("reasonCode");
  });

  it("does not cut a Markdown link when it crosses the total bound", async () => {
    const prefix = `${"Programme. ".repeat(7_000)} `;
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `<html><body><p>${prefix}<a href="/tickets?${"x".repeat(8_000)}">Tickets</a></p></body></html>`,
      ),
    });
    expect(result.markdown).toContain("Programme.");
    expect(result.markdown).toContain("[Tickets](");
    const projected = boundedToolSource(result);
    expect(projected.truncated).toBe(true);
    expect(projected.markdown).not.toContain("[Tickets](");
    expect(projected.markdown).not.toContain("/tickets?");
  });

  it("keeps escaped label brackets and URL brackets inside a whole link", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `<p>${"a".repeat(79_670)} <a href="/tickets?group=[early]">Tickets [early] passes</a> Later details.</p>`,
      ),
    });
    const linkStart = result.markdown.indexOf("[Tickets");
    const linkEnd = result.markdown.indexOf(")", linkStart) + 1;
    expect(linkStart).toBeGreaterThan(0);
    expect(result.markdown).toContain("\\[early\\]");
    for (let end = linkStart + 1; end < linkEnd; end += 1) {
      const projected = boundedToolSource(result, end + 300);
      expect(projected.truncated).toBe(true);
      expect(projected.markdown).not.toContain("[Tickets");
    }
    expect(boundedToolSource(result).markdown).not.toContain("[Tickets");
  });

  it.each([
    "<!-- Navigation -->",
    "<!-- /Navigation -->",
    "<!-- Main content -->",
  ])("does not cut the region comment %s", (comment) => {
    const result = {
      attemptedUrl: sourceUrl,
      finalUrl: sourceUrl,
      retrievedAt: "2026-10-03T12:00:00Z",
      method: "http" as const,
      status: "ok" as const,
      markdown: "",
    };
    for (let offset = 1; offset < comment.length; offset += 1) {
      result.markdown = "a".repeat(1_000 - offset) + comment + "Later";
      const projected = boundedToolSource(result, 1_300);
      expect(projected.truncated).toBe(true);
      expect(projected.markdown).toBe("a".repeat(1_000 - offset));
    }
  });

  it("omits a link that starts at the projection start and crosses its bound", () => {
    const result = {
      attemptedUrl: sourceUrl,
      finalUrl: sourceUrl,
      retrievedAt: "2026-10-03T12:00:00Z",
      method: "http" as const,
      status: "ok" as const,
      markdown: `[Tickets](${sourceUrl}?${"x".repeat(2_000)})`,
    };
    expect(boundedToolSource(result, 1_300)).toMatchObject({
      markdown: "",
      truncated: true,
    });
  });

  it.each([
    ["Plain [ text ", "Tail"],
    ["Plain [ text with a later closing bracket ", "] Tail"],
  ])("keeps ordinary bracket text in a long projection: %s", (start, tail) => {
    const markdown = start + "Festival details. ".repeat(6_000) + tail;
    const projected = boundedToolSource({
      attemptedUrl: sourceUrl,
      finalUrl: sourceUrl,
      retrievedAt: "2026-10-03T12:00:00Z",
      method: "http",
      status: "ok",
      markdown,
    });
    expect(projected.truncated).toBe(true);
    expect(projected.markdown.length).toBeGreaterThan(79_000);
    expect(projected.markdown).toContain(start);
  });

  it("extracts continuous text, structured event data, timestamps and ticket links", async () => {
    const result = await readPage(sourceUrl, {
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
      status: "ok",
    });
    expect(result).not.toHaveProperty("blocks");
    expect(result.markdown).toContain("startDate: 2027-06-10");
    expect(result.markdown).toContain("Thursday: 2027-06-10");
    expect(result.markdown).toContain("https://festival.example/tickets");
  });

  it("keeps a date shown only in a header anchor and organizer text in the footer", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<html><body>
        <header><nav><a href="/2027"><span>7TH-10TH</span><span>JULY2027</span></a></nav></header>
        <main><p>Join the festival in 2027.</p></main>
        <footer><div><span>Organised by Example Events Ltd</span></div></footer>
      </body></html>`),
    });
    expect(result.status).toBe("ok");
    expect(result.markdown).toContain("7TH-10THJULY2027");
    expect(result.markdown).toContain("Organised by Example Events Ltd");
  });

  it("traverses JSON-LD graph nodes for edition facts and organizer identity", async () => {
    const result = await readPage(sourceUrl, {
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

  it.each(["application/ld+json", "text/html"])(
    "resolves structured-only URLs against the final page URL in %s",
    async (contentType) => {
      const data = JSON.stringify({
        "@type": "MusicEvent",
        offers: { url: "../tickets" },
        organizer: { url: "https://organizer.example/" },
      });
      const request = mockResponse(data, contentType);
      request.mockResolvedValueOnce({
        finalUrl: "https://festival.example/redirected/2027/",
        status: 200,
        contentType,
        body: Buffer.from(
          contentType === "text/html"
            ? `<script type="application/ld+json">${data}</script><p>Festival details.</p>`
            : data,
        ),
      });
      const result = await readPage(sourceUrl, {
        budget: createResearchBudget(),
        request,
      });
      expect(result.markdown).toContain(
        "offers: url: https://festival.example/redirected/tickets",
      );
      expect(result.markdown).toContain(
        "organizer: url: https://organizer.example/",
      );
    },
  );

  it("keeps JSON-LD location and organizer properties under distinct paths", async () => {
    const result = await readPage(sourceUrl, {
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
    const result = await readPage("https://www.instagram.com/festival/", {
      budget: createResearchBudget(),
      request,
    });
    expect(result).toMatchObject({
      method: "social_stub",
      status: "unsupported",
      reasonCode: "social_content_unsupported",
    });
    expect(result.finalUrl).toBe("https://www.instagram.com/festival/");
    expect(request).not.toHaveBeenCalled();
  });

  it("reports sparse JavaScript page limits without executing scripts", async () => {
    const firecrawlRequest = mockResponse("<main>Rendered page</main>");
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        "<html><body><main>Loading festival details</main><script src='/app.js'></script></body></html>",
      ),
      firecrawlRequest,
    });
    expect(result).toMatchObject({
      method: "http",
      status: "ok",

      reasonCode: "javascript_required",
    });
    expect(result.markdown).toContain("Loading festival details");
    expect(firecrawlRequest).not.toHaveBeenCalled();
  });

  it("selects successful rendered HTML", async () => {
    const budget = createResearchBudget();
    const firecrawlRequest = mockResponse(
      `<main>${"Festival programme ".repeat(20)}</main>`,
    );
    firecrawlRequest.mockResolvedValueOnce({
      finalUrl: `${sourceUrl}/rendered`,
      status: 200,
      contentType: "text/html",
      body: Buffer.from(`<main>${"Festival programme ".repeat(20)}</main>`),
    });
    const result = await readPage(sourceUrl, {
      budget,
      request: mockResponse(
        '<main>Loading festival details</main><script src="/app.js"></script>',
      ),
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
    expect(firecrawlRequest).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({ format: "html", apiKey: "test-key" }),
    );
    expect(result).toMatchObject({
      method: "firecrawl",
      finalUrl: `${sourceUrl}/rendered`,
      status: "ok",
    });
    expect(result.markdown).toContain("Festival programme");
    expect(budget.snapshot().pages).toBe(2);
  });

  it.each([
    '<main><a href="https://raffle.festival.example/"><img src="/raffle.png"></a></main>',
    '<main><a href="https://raffle.festival.example/">Raffle</a></main>',
    "<main></main>",
  ])(
    "keeps successful short HTML in page and tool output: %s",
    async (html) => {
      const budget = createResearchBudget();
      const config = {
        apiKey: "fixture",
        model: "fixture",
        limits: budget.limits,
      };
      const extracted = extractSource(html, sourceUrl, "text/html");
      expect(extracted.nonNavigationTextLength).toBeLessThan(200);
      if (html.includes("<img")) {
        expect(extracted.nonNavigationTextLength).toBe(0);
      }
      const firecrawlRequest = mockResponse(html);
      const sources = createSourceSession(budget, config, [], {
        readPage: (url, options) =>
          readPage(url, {
            ...options,
            request: mockResponse(
              '<main>Direct details</main><script src="/app.js"></script>',
            ),
            firecrawlRequest,
            firecrawlKey: "test-key",
          }),
      });
      const page = await sources.readPage(sourceUrl);
      const tool = createReadPageTool({
        sources,
        budget,
        modelContext: () => ({ stage: "research", step: 1, attempt: 1 }),
      });
      const output = await tool.execute!({ url: sourceUrl }, {} as never);
      expect(page).toMatchObject({
        method: "firecrawl",
        status: "ok",
        httpStatus: 200,
      });
      expect(page.reasonCode).toBeUndefined();
      expect(page.markdown).toContain("## Direct HTTP response");
      expect(page.markdown).toContain("Direct details");
      expect(output).toMatchObject({
        status: "ok",
        markdown: page.markdown,
        truncated: false,
      });
      expect(output).not.toHaveProperty("reasonCode");
      if (html.includes("<a")) {
        expect(page.markdown).toContain("https://raffle.festival.example/");
      }
      expect(firecrawlRequest).toHaveBeenCalledOnce();
      expect(budget.snapshot().pages).toBe(2);
    },
  );

  it("keeps direct metadata, JSON-LD and safe links alongside rendered content", async () => {
    const budget = createResearchBudget();
    const firecrawlRequest = mockResponse(
      `<main><p>${"Festival programme ".repeat(20)}</p><a href="/tickets">Tickets</a><a href="/programme">Programme</a></main>`,
    );
    const result = await readPage(sourceUrl, {
      budget,
      request:
        mockResponse(`<head><meta name="description" content="Festival on 10 June 2027"></head><body><main>Loading</main>
        <a href="/details">Details</a>
        <script type="application/ld+json">{"@type":"MusicEvent","startDate":"2027-06-10","url":"https://festival.example/tickets"}</script>
        <script src="/app.js"></script></body>`),
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      method: "firecrawl",
      status: "ok",
    });
    expect(result.markdown).toContain("Festival programme");
    expect(result.markdown).toContain("## Direct HTTP response");
    const direct = result.markdown.split("## Direct HTTP response")[1];
    expect(direct).toContain('description: "Festival on 10 June 2027"');
    expect(result.markdown.split("## Direct HTTP response")[0]).not.toContain(
      "description:",
    );
    expect(result.markdown).toContain("startDate: 2027-06-10");
    expect(result.markdown).toContain(
      "[Tickets](https://festival.example/tickets)",
    );
    expect(result.markdown).toContain(
      "[Programme](https://festival.example/programme)",
    );
    expect(result.markdown).toContain(
      "[Details](https://festival.example/details)",
    );
    expect(budget.snapshot().pages).toBe(2);
  });

  it("keeps complete rendered and direct text above the former extraction bound", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(`<main>Loading</main>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "MusicEvent",
          description: "Extra detail ".repeat(2_000) + "DirectTail",
        })}</script><script src="/app.js"></script>`),
      firecrawlRequest: mockResponse(
        `<main>${"Festival programme ".repeat(2_000)}RenderedTail</main>`,
      ),
      firecrawlKey: "test-key",
    });
    expect(result).toMatchObject({
      method: "firecrawl",
      status: "ok",
    });
    expect(result.markdown.length).toBeGreaterThan(20_000);
    expect(result.markdown).toContain("DirectTail");
    expect(result.markdown).toContain("RenderedTail");
    expect(result.markdown.indexOf("Festival programme")).toBeLessThan(
      result.markdown.indexOf("## Direct HTTP response"),
    );
    expect(result.reasonCode).toBeUndefined();
    expect(result.markdown).toContain("## Direct HTTP response");
  });

  it("keeps direct content when a successful render contains a short placeholder", async () => {
    const firecrawlRequest = mockResponse(
      `<main>${"Loading festival details ".repeat(5)}</main>`,
    );
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        '<main>Festival dates and tickets</main><script src="/analytics.js"></script>',
      ),
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      method: "firecrawl",
      status: "ok",
    });
    expect(result.markdown).toContain("Festival dates and tickets");
    expect(result.markdown).toContain("Loading festival details");
    expect(result.reasonCode).toBeUndefined();
  });

  it("keeps the direct page when less than one second remains", async () => {
    let now = 0;
    const budget = createResearchBudget({ durationMs: 1_500 }, () => now);
    const request = mockResponse(
      '<main>Loading</main><script src="/app.js"></script>',
    );
    request.mockImplementationOnce(async () => {
      now = 600;
      return {
        finalUrl: sourceUrl,
        status: 200,
        contentType: "text/html",
        body: Buffer.from(
          '<main>Loading</main><script src="/app.js"></script>',
        ),
      };
    });
    const firecrawlRequest = mockResponse(
      `<main>${"Festival programme ".repeat(20)}</main>`,
    );
    const result = await readPage(sourceUrl, {
      budget,
      request,
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(firecrawlRequest).not.toHaveBeenCalled();
    expect(budget.snapshot().pages).toBe(1);
    expect(result).toMatchObject({ method: "http", status: "ok" });
  });

  it("keeps direct content and logs a safe code when rendering fails", async () => {
    const firecrawlRequest = vi
      .fn()
      .mockRejectedValue(new FirecrawlError("firecrawl_http_402"));
    const log = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        '<main>Loading</main><script src="/app.js"></script>',
      ),
      firecrawlRequest,
      firecrawlKey: "test-key",
      log,
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
    expect(log.warn).toHaveBeenCalledWith(
      "JavaScript source Firecrawl fallback failed",
      expect.objectContaining({ errorCode: "firecrawl_http_402" }),
    );
    expect(result).toMatchObject({
      method: "http",
      status: "ok",
      reasonCode: "javascript_required",
    });
    expect(result.markdown).toContain("Loading");
  });

  it("keeps direct content when Firecrawl reports a blocked source page", async () => {
    const blockedBody = `<main>${"Access denied ".repeat(20)}</main>`;
    const firecrawlRequest = mockResponse(blockedBody);
    firecrawlRequest.mockResolvedValueOnce({
      finalUrl: sourceUrl,
      status: 403,
      contentType: "text/html",
      body: Buffer.from(blockedBody),
    });
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        '<main>Loading</main><a href="/details">Details</a><script src="/app.js"></script>',
      ),
      firecrawlRequest,
      firecrawlKey: "test-key",
    });
    expect(firecrawlRequest).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      method: "http",
      status: "ok",
      reasonCode: "javascript_required",
    });
    expect(result.markdown).toContain("Loading");
    expect(result.markdown).not.toContain("Access denied");
  });

  it("ignores long navigation when assessing a JavaScript page", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse(
        `<html><body><header><nav>${"Festival navigation ".repeat(30)}</nav></header><main id="root"></main><script src="/app.js"></script></body></html>`,
      ),
    });
    expect(result).toMatchObject({
      method: "http",
      status: "ok",

      reasonCode: "javascript_required",
    });
  });

  it("returns ok for an empty supported response", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse("", "text/plain"),
    });
    expect(boundedToolSource(result)).toEqual({
      url: sourceUrl,
      status: "ok",
      markdown: "",
      truncated: false,
    });
  });

  it("rejects oversized and unsupported responses", async () => {
    const oversized = await readPage(sourceUrl, {
      budget: createResearchBudget({ pageBytes: 2 }),
      request: mockResponse("too large"),
    });
    expect(oversized.reasonCode).toBe("oversized_response");
    const pdf = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: mockResponse("%PDF", "application/pdf"),
    });
    expect(pdf.status).toBe("unsupported");
  });

  it("returns a safe reasonCode without exposing a URL in a network error", async () => {
    const result = await readPage(sourceUrl, {
      budget: createResearchBudget(),
      request: vi
        .fn()
        .mockRejectedValue(
          new Error("failure at https://secret.example/?token=private"),
        ),
    });
    expect(result.reasonCode).toBe("request_failed");
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

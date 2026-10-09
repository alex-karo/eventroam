import { z } from "zod";
import {
  assertPublicUrl,
  type BoundedResponse,
  type LookupHost,
} from "./network";

const scrapeResponse = z.object({
  success: z.literal(true),
  data: z.object({
    rawHtml: z.string(),
    metadata: z.object({
      statusCode: z.number().int().min(100).max(599),
      url: z.string().optional(),
      sourceURL: z.string().optional(),
    }),
  }),
});

export class FirecrawlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "FirecrawlError";
  }
}

async function validateSourceUrl(
  url: string,
  resolver: LookupHost | undefined,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    await Promise.race([assertPublicUrl(url, resolver), cancelled]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Fetch raw HTML so fallback pages use the same extraction rules as HTTP. */
export async function getFirecrawlResponse(
  target: string,
  options: {
    apiKey: string;
    maxBytes: number;
    timeoutMs: number;
    resolver?: LookupHost;
    request?: typeof fetch;
  },
): Promise<BoundedResponse> {
  // Firecrawl rejects provider timeouts below one second; do not start work
  // that cannot fit in the remaining local budget.
  if (options.timeoutMs < 1_000) {
    throw new FirecrawlError("timeout");
  }
  const signal = AbortSignal.timeout(options.timeoutMs);
  try {
    await validateSourceUrl(target, options.resolver, signal);
    const response = await (options.request ?? fetch)(
      "https://api.firecrawl.dev/v2/scrape",
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url: target,
          formats: ["rawHtml"],
          onlyMainContent: false,
          maxAge: 0,
          timeout: options.timeoutMs,
          proxy: "auto",
          skipTlsVerification: false,
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new FirecrawlError(`firecrawl_http_${response.status}`);
    }
    if (Number(response.headers.get("content-length")) > options.maxBytes) {
      await response.body?.cancel();
      throw new FirecrawlError("oversized_response");
    }
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        bytes += chunk.byteLength;
        if (bytes > options.maxBytes) {
          throw new FirecrawlError("oversized_response");
        }
        chunks.push(chunk);
      }
    }
    const parsed = scrapeResponse.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!parsed.success) {
      throw new FirecrawlError("firecrawl_invalid_response");
    }
    const { rawHtml, metadata } = parsed.data.data;
    const finalUrl = metadata.url ?? metadata.sourceURL ?? target;
    await validateSourceUrl(finalUrl, options.resolver, signal);
    signal.throwIfAborted();
    return {
      finalUrl,
      status: metadata.statusCode,
      contentType: "text/html",
      body: Buffer.from(rawHtml),
    };
  } catch (error) {
    if (signal.aborted) {
      throw new FirecrawlError("timeout");
    }
    if (error instanceof SyntaxError) {
      throw new FirecrawlError("firecrawl_invalid_response");
    }
    throw error;
  }
}

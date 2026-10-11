import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import got, { MaxRedirectsError, TimeoutError } from "got";
import type { LookupAddress } from "node:dns";

export type LookupHost = (hostname: string) => Promise<LookupAddress[]>;

export const lookupHost: LookupHost = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

const blockedIpv4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4.addSubnet(address, prefix, "ipv4");
}
const blockedIpv6 = new BlockList();
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedIpv6.addSubnet(address, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return !blockedIpv4.check(address, "ipv4");
  }
  if (family === 6) {
    return !blockedIpv6.check(address, "ipv6");
  }
  return false;
}

export class UnsafeSourceError extends Error {
  constructor(message = "unsafe_address") {
    super(message);
    this.name = "UnsafeSourceError";
  }
}

function parseSourceUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeSourceError("invalid_url");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && !["80", "443"].includes(parsed.port))
  ) {
    throw new UnsafeSourceError("unsafe_url");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (/^(?:localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(hostname)) {
    throw new UnsafeSourceError("unsafe_address");
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new UnsafeSourceError("unsafe_address");
  }
  return parsed;
}

export async function assertPublicUrl(
  url: string,
  resolver: LookupHost = lookupHost,
): Promise<{ url: URL; addresses: LookupAddress[] }> {
  const parsed = parseSourceUrl(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(hostname);
  const addresses = literal
    ? [{ address: hostname, family: literal }]
    : await resolver(hostname);
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new UnsafeSourceError("unsafe_address");
  }
  return { url: parsed, addresses };
}

export interface BoundedResponse {
  finalUrl: string;
  status: number;
  contentType: string;
  body: Buffer;
}

/** Fetches each hop through a checked, pinned DNS address; redirects never bypass validation. */
export async function getBoundedResponse(
  target: string,
  options: {
    maxBytes: number;
    timeoutMs: number;
    resolver?: LookupHost;
    maxRedirects?: number;
    /** Called before each retry so the caller can charge/limit its shared budget. */
    onRetry?: () => void;
  },
): Promise<BoundedResponse> {
  const url = parseSourceUrl(target);
  const deadline = Date.now() + options.timeoutMs;
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(new Error("timeout")),
    options.timeoutMs,
  );
  let hookError: unknown;
  try {
    const response = await got(url, {
      responseType: "buffer",
      throwHttpErrors: false,
      followRedirect: (response) => {
        try {
          // Guard before Got buffers redirect errors or strips Location credentials.
          parseSourceUrl(
            new URL(response.headers.location!, response.url).href,
          );
          if (response.redirectUrls.length >= (options.maxRedirects ?? 5)) {
            throw new Error("redirect_limit");
          }
          return true;
        } catch (error) {
          hookError = error;
          abort.abort(error);
          response.destroy();
          return false;
        }
      },
      maxRedirects: options.maxRedirects ?? 5,
      signal: abort.signal,
      retry: {
        limit: 2,
        methods: ["GET"],
        statusCodes: [429, 500, 502, 503, 504],
        errorCodes: ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ECONNREFUSED"],
      },
      headers: {
        "user-agent": "EventroamResearch/1.0 (+local source verification)",
        accept:
          "text/html,application/xhtml+xml,application/json,text/plain;q=0.8,*/*;q=0.1",
        "accept-encoding": "identity",
      },
      decompress: false,
      hooks: {
        beforeRedirect: [
          async (_requestOptions, response) => {
            const destroy = () => response.destroy();
            abort.signal.addEventListener("abort", destroy, { once: true });
            try {
              // Got does not emit downloadProgress for intermediate responses.
              let bytes = 0;
              if (
                Number(response.headers["content-length"]) > options.maxBytes
              ) {
                throw new Error("oversized_response");
              }
              for await (const chunk of response) {
                bytes += chunk.length;
                if (bytes > options.maxBytes) {
                  throw new Error("oversized_response");
                }
              }
              abort.signal.throwIfAborted();
            } catch (error) {
              if (abort.signal.aborted) {
                throw abort.signal.reason;
              }
              if (
                error instanceof Error &&
                error.message === "oversized_response"
              ) {
                hookError = error;
                abort.abort(error);
              }
              throw error;
            } finally {
              abort.signal.removeEventListener("abort", destroy);
            }
          },
        ],
        beforeRequest: [
          async (requestOptions) => {
            try {
              if (requestOptions.username || requestOptions.password) {
                throw new UnsafeSourceError("unsafe_url");
              }
              // Got runs this hook for the initial request, each redirect and retry.
              const { addresses } = await assertPublicUrl(
                requestOptions.url!.href,
                options.resolver,
              );
              abort.signal.throwIfAborted();
              const address = addresses[0];
              requestOptions.dnsLookup = (
                _hostname,
                lookupOptions,
                callback,
              ) => {
                if (lookupOptions.all) {
                  callback(null, [address]);
                } else {
                  callback(null, address.address, address.family);
                }
              };
              requestOptions.timeout = {
                request: Math.max(1, deadline - Date.now()),
              };
            } catch (error) {
              if (error instanceof UnsafeSourceError) {
                hookError = error;
              }
              throw error;
            }
          },
        ],
        beforeRetry: [
          () => {
            try {
              options.onRetry?.();
            } catch (error) {
              hookError = error;
              throw error;
            }
          },
        ],
        afterResponse: [
          (response) => {
            if (
              [301, 302, 303, 307, 308].includes(response.statusCode) &&
              !response.headers.location
            ) {
              throw new Error("redirect_without_location");
            }
            return response;
          },
        ],
      },
    }).on("downloadProgress", ({ transferred, total }) => {
      if (
        transferred > options.maxBytes ||
        (total !== undefined && total > options.maxBytes)
      ) {
        abort.abort(new Error("oversized_response"));
      }
    });
    return {
      finalUrl: response.url,
      status: response.statusCode,
      contentType: String(response.headers["content-type"] ?? "").toLowerCase(),
      body: Buffer.from(response.body),
    };
  } catch (error) {
    if (hookError) {
      throw hookError;
    }
    if (abort.signal.aborted) {
      throw abort.signal.reason;
    }
    if (error instanceof TimeoutError) {
      throw new Error("timeout");
    }
    if (error instanceof MaxRedirectsError) {
      throw new Error("redirect_limit");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

import { expect, test, vi } from "vitest";
import got from "got";
import { geocode, geoapifyTransport, parseGeoapify } from "./geoapify";
vi.mock("got", () => ({ default: vi.fn() }));
const forward = {
  direction: "forward" as const,
  query: "Park, Lisbon",
  countryCode: "PT",
};
function response(statusCode: number, body: string) {
  const promise = Promise.resolve({ statusCode, body: Buffer.from(body) });
  return Object.assign(promise, { on: vi.fn(() => promise) });
}
test("fixed endpoints enforce country without proximity and disable retries and redirects", async () => {
  const request = vi
    .mocked(got)
    .mockReturnValue(response(200, '{"results":[]}') as never);
  const transport = geoapifyTransport("PRIVATE_KEY");
  await transport(forward, new AbortController().signal);
  const [url, options] = request.mock.calls[0];
  expect(String(url)).toContain("https://api.geoapify.com/v1/geocode/search?");
  expect(new URL(String(url)).searchParams.get("filter")).toBe(
    "countrycode:pt",
  );
  expect(new URL(String(url)).searchParams.has("bias")).toBe(false);
  expect(options).toMatchObject({
    retry: { limit: 0 },
    followRedirect: false,
    throwHttpErrors: false,
  });
  await transport(
    { direction: "reverse", latitude: 38, longitude: -9 },
    new AbortController().signal,
  );
  expect(String(request.mock.calls[1][0])).toContain("/reverse?");
  expect(
    new URL(String(request.mock.calls[1][0])).searchParams.get("limit"),
  ).toBe("1");
});
test.each([
  [401, "unavailable"],
  [403, "unavailable"],
  [429, "rate_limited"],
  [500, "provider_error"],
])("HTTP %s gives bounded %s", async (status, code) => {
  const request = vi
    .mocked(got)
    .mockReturnValueOnce(response(Number(status), "{}") as never);
  const before = request.mock.calls.length;
  expect(
    await geocode(forward, {
      apiKey: "PRIVATE_KEY",
      signal: new AbortController().signal,
    }),
  ).toEqual({ status: "error", code });
  expect(request.mock.calls.length - before).toBe(1);
});
test("malformed JSON and transport errors never expose keys, URLs or response bodies", async () => {
  vi.mocked(got).mockReturnValue(response(200, "PRIVATE_BODY") as never);
  const result = await geocode(forward, {
    apiKey: "PRIVATE_KEY",
    signal: new AbortController().signal,
  });
  expect(result).toEqual({ status: "error", code: "invalid_response" });
  vi.mocked(got).mockImplementationOnce(() => {
    throw new Error("PRIVATE_URL?apiKey=PRIVATE_KEY");
  });
  const failed = await geocode(forward, {
    apiKey: "PRIVATE_KEY",
    signal: new AbortController().signal,
  });
  expect(failed).toEqual({ status: "error", code: "network_error" });
});
test("parser keeps reverse results as nearby context and distinguishes invalid and empty responses", () => {
  expect(
    parseGeoapify(
      { direction: "reverse", latitude: 38.71, longitude: -9.14 },
      {
        status: 200,
        body: {
          results: [
            {
              lat: 38.72,
              lon: -9.14,
              result_type: "city",
              country_code: "pt",
              formatted: "Lisbon",
            },
          ],
        },
      },
    ),
  ).toMatchObject({
    status: "success",
    direction: "reverse",
    queriedPoint: { latitude: 38.71, longitude: -9.14 },
    nearby: { objectType: "locality", countryCode: "PT" },
    distanceKm: expect.any(Number),
  });
  expect(parseGeoapify(forward, { status: 200, body: {} })).toEqual({
    status: "error",
    code: "invalid_response",
  });
  expect(
    parseGeoapify(forward, { status: 200, body: { results: [] } }),
  ).toMatchObject({ status: "success", candidates: [] });
});
test("parser returns at most three candidates and excludes another country", () => {
  const points = ["es", "pt", "pt", "pt", "pt"].map((country_code) => ({
    lat: 38,
    lon: -9,
    country_code,
    result_type: "city",
  }));
  const result = parseGeoapify(forward, {
    status: 200,
    body: { results: points },
  });
  expect(result).toMatchObject({
    status: "success",
    candidates: [
      expect.objectContaining({ countryCode: "PT" }),
      expect.objectContaining({ countryCode: "PT" }),
    ],
  });
});

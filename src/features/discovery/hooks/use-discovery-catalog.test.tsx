// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { useDiscoveryCatalog } from "./use-discovery-catalog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("older refresh results cannot replace the latest catalog or set an error", async () => {
  const { build } = testFixtures();
  const initialCatalog = { summaries: [], genres: [] };
  const latestCatalog = { summaries: [build.summary()], genres: [] };
  const first = Promise.withResolvers<Response>();
  const second = Promise.withResolvers<Response>();
  const third = Promise.withResolvers<Response>();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise),
  );

  const { result } = renderHook(() => useDiscoveryCatalog(initialCatalog));
  await act(async () => {
    const olderRetry = result.current.retry();
    const newerRetry = result.current.retry();
    third.resolve(Response.json(latestCatalog));
    await newerRetry;
    second.reject(new Error("Refresh failed"));
    await olderRetry;
    first.resolve(Response.json(initialCatalog));
  });

  expect(result.current.catalog).toEqual(latestCatalog);
  expect(result.current.loadError).toBe(false);
});

import { afterEach, expect, test, vi } from "vitest";
import { emptyFilters } from "@/features/discovery/model/discovery";
import {
  normalizeDiscoveryLocation,
  pushDiscoveryFilters,
  pushDiscoveryView,
  readDiscoveryLocation,
} from "@/features/discovery/hooks/discovery-url";

function browser(url: string) {
  const state = {
    location: new URL(url),
    history: {
      pushState: vi.fn((_data: unknown, _title: string, path: string) => {
        state.location = new URL(path, state.location);
      }),
      replaceState: vi.fn((_data: unknown, _title: string, path: string) => {
        state.location = new URL(path, state.location);
      }),
    },
  };
  vi.stubGlobal("window", state);
  return state;
}

afterEach(() => vi.unstubAllGlobals());

test("normalization replaces history and preserves explicit valid view", () => {
  const state = browser(
    "https://example.org/?country=pt&country=PT&view=map&bbox=ignored",
  );
  normalizeDiscoveryLocation("country=PT");
  expect(state.location.search).toBe("?country=PT&view=map");
  expect(state.history.replaceState).toHaveBeenCalledTimes(1);
  normalizeDiscoveryLocation("country=PT");
  expect(state.history.replaceState).toHaveBeenCalledTimes(1);
  expect(state.history.pushState).not.toHaveBeenCalled();
});

test("applying filters and switching views preserve applied filters across URL restoration", () => {
  const state = browser("https://example.org/?view=map");
  const filters = {
    ...emptyFilters(),
    q: "Field Days",
    countries: ["FR", "PT"],
  };
  pushDiscoveryFilters(filters);
  expect(readDiscoveryLocation([])).toEqual({
    filters,
    view: "map",
    error: null,
  });
  pushDiscoveryView("list");
  expect(state.location.searchParams.has("view")).toBe(false);
  expect(readDiscoveryLocation([])).toEqual({
    filters,
    view: "list",
    error: null,
  });
  pushDiscoveryView("map");
  pushDiscoveryFilters(emptyFilters());
  expect(state.location.search).toBe("?view=map");
  expect(state.history.pushState).toHaveBeenCalledTimes(4);
});

test("invalid filters survive view changes and restore as errors", () => {
  const state = browser("https://example.org/?from=2026-01-01&view=map");
  const before = readDiscoveryLocation([]);
  expect(before.filters).toBeNull();
  expect(before.error).toBeTruthy();
  expect(before.view).toBe("map");
  pushDiscoveryView("list");
  expect(state.location.search).toBe("?from=2026-01-01");
  expect(readDiscoveryLocation([])).toEqual({ ...before, view: "list" });
});

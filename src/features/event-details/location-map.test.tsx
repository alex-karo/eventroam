// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocationMap, locationZoom } from "./location-map";
const mock = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {};
  const map = {
    addControl: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler;
    }),
    resize: vi.fn(),
    remove: vi.fn(),
  };
  const marker = { setLngLat: vi.fn(), addTo: vi.fn(), remove: vi.fn() };
  marker.setLngLat.mockReturnValue(marker);
  marker.addTo.mockReturnValue(marker);
  return {
    handlers,
    map,
    marker,
    Map: vi.fn(function () {
      return map;
    }),
    Marker: vi.fn(function () {
      return marker;
    }),
    supported: vi.fn(() => true),
  };
});
vi.mock("mapbox-gl", () => ({
  default: {
    Map: mock.Map,
    Marker: mock.Marker,
    supported: mock.supported,
    NavigationControl: vi.fn(function () {
      return {};
    }),
  },
}));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "local-test-token");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
test("map uses saved coordinates, qualified zoom, attribution and no wheel zoom", async () => {
  render(<LocationMap latitude={38} longitude={-9} precision="locality" />);
  await waitFor(() => expect(mock.Map).toHaveBeenCalled());
  expect(mock.Map).toHaveBeenCalledWith(
    expect.objectContaining({
      center: [-9, 38],
      zoom: locationZoom("locality"),
      scrollZoom: false,
      attributionControl: true,
    }),
  );
  expect(locationZoom("exact")).toBeGreaterThan(locationZoom("approximate"));
  expect(locationZoom("approximate")).toBeGreaterThan(locationZoom("region"));
  expect(mock.map.addControl).toHaveBeenCalled();
  act(() => mock.handlers.error());
  expect(screen.getByRole("status").textContent).toContain(
    "Map is unavailable",
  );
});
test("missing configuration shows a visible fallback without constructing a map", () => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
  render(<LocationMap latitude={38} longitude={-9} precision="exact" />);
  expect(screen.getByRole("status").textContent).toContain("external map link");
  expect(mock.Map).not.toHaveBeenCalled();
});

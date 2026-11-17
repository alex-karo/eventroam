// @vitest-environment jsdom
import { useEffect, type ComponentProps } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { emptyFilters } from "./model/discovery";
import type { DiscoveryMap } from "./map/discovery-map";
import type { MapArea } from "./model/map-area";
import { historyVisitToken, readVisit } from "@/site/discovery-context";
import { Discovery } from "./discovery";

const mock = vi.hoisted(() => ({
  props: null as ComponentProps<typeof DiscoveryMap> | null,
  area: null as MapArea | null,
}));
vi.mock("./map/discovery-map", () => ({
  hasMapPoint: (row: { latitude: number | null; longitude: number | null }) =>
    row.latitude !== null && row.longitude !== null,
  DiscoveryMap: function MapStub(props: ComponentProps<typeof DiscoveryMap>) {
    mock.props = props;
    const { onAreaChange, restoreCamera } = props;
    useEffect(() => {
      onAreaChange(mock.area);
    }, [onAreaChange, restoreCamera]);
    return <div aria-label="Map stub" />;
  },
}));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", "/?country=PT");
  mock.props = null;
  mock.area = { west: -10, east: -9, south: 38, north: 39 };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  for (const name of ["show", "showModal", "close"] as const) {
    Object.defineProperty(HTMLDialogElement.prototype, name, {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = name !== "close";
      },
    });
  }
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  const { build } = testFixtures();
  const rows = [
    build.summary({
      id: "lisbon",
      eventName: "Lisbon Festival",
      countryCode: "PT",
      latitude: 38.7,
      longitude: -9.1,
    }),
    build.summary({
      id: "porto",
      eventName: "Porto Festival",
      countryCode: "PT",
      latitude: 41,
      longitude: -8.6,
    }),
    build.summary({
      id: "unlocated",
      eventName: "Unlocated Festival",
      countryCode: "PT",
      latitude: null,
      longitude: null,
    }),
    build.summary({
      id: "spain",
      eventName: "Spain Festival",
      countryCode: "ES",
      latitude: 38.7,
      longitude: -9.1,
    }),
  ];
  const catalog = { summaries: rows, genres: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/discovery"
        ? Promise.resolve(Response.json(catalog))
        : new Promise<Response>(() => {}),
    ),
  );
  const props = {
    apexHref: "/about",
    festivalsHref: "/",
    initialCatalog: catalog,
    initialFilters: { ...emptyFilters(), countries: ["PT"] },
    initialError: null,
    initialNow: "2026-11-17T12:00:00Z",
    initialView: "map" as const,
  };
  const view = render(<Discovery {...props} />);
  await waitFor(() => expect(mock.props).not.toBeNull());
  await waitFor(() =>
    expect(
      view
        .getByRole("checkbox", { name: "Follow map" })
        .hasAttribute("disabled"),
    ).toBe(mock.area === null),
  );
  return { view, rows, props };
}

test("the default area limits rows and pending counts while the map keeps all filter results", async () => {
  const { view, rows } = await setup();
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "1 festival in map area",
  );
  expect(mock.props!.summaries).toEqual(rows.slice(0, 3));
  const checkbox = view.getByRole("checkbox", {
    name: "Follow map",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  expect(checkbox.getAttribute("aria-describedby")).toBe("follow-map-help");
  expect(
    view.getByText(/Turn off to include events without map locations/),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: /^Where:/ }));
  expect(view.getByRole("button", { name: "Show 1 event" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  fireEvent.click(checkbox);
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "3 festivals",
  );
  expect(
    view.getByRole("button", { name: /^Select Unlocated Festival/ }),
  ).toBeTruthy();
  expect(window.location.search).toContain("country=PT");
  expect(mock.props!.summaries).toEqual(rows.slice(0, 3));
});

test("an empty area uses the heading switch for recovery and normal filter-empty results retain reset", async () => {
  const { view } = await setup();
  act(() =>
    mock.props!.onAreaChange({ west: 10, east: 20, south: 0, north: 10 }),
  );
  expect(view.getByText("No events in this map area.")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Clear all filters" })).toBeNull();
  fireEvent.click(view.getByRole("checkbox", { name: "Follow map" }));
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "3 festivals",
  );
  expect(window.location.search).toContain("country=PT");
  fireEvent.change(
    view.getByRole("textbox", { name: "Search festival names" }),
    { target: { value: "missing" } },
  );
  fireEvent.submit(view.getByRole("search"));
  expect(view.getByText("No events match these filters.")).toBeTruthy();
  expect(view.getByRole("button", { name: "Clear all filters" })).toBeTruthy();
});

test("selection and mobile list expansion keep the area; leaving it keeps the card open", async () => {
  const { view } = await setup();
  fireEvent.click(view.getByRole("button", { name: "Expand list" }));
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "1 festival in map area",
  );
  fireEvent.click(
    view.getByRole("button", { name: /^Show on map: Lisbon Festival/ }),
  );
  expect(
    view.getByRole("region", { name: "Selected edition details" }),
  ).toBeTruthy();
  act(() =>
    mock.props!.onAreaChange({ west: -9, east: -8, south: 40, north: 42 }),
  );
  expect(
    view.queryByRole("button", { name: /^Show on map: Lisbon Festival/ }),
  ).toBeNull();
  expect(
    view.getByRole("region", { name: "Selected edition details" }),
  ).toBeTruthy();
  expect(mock.props!.selectedId).toBe("lisbon");
});

test("visit restoration keeps the follow setting and uses the restored map area", async () => {
  const { view, props } = await setup();
  const token = historyVisitToken()!;
  fireEvent.click(view.getByRole("checkbox", { name: "Follow map" }));
  act(() =>
    mock.props!.onCameraChange({ longitude: -8.5, latitude: 41, zoom: 8 }),
  );
  expect(readVisit(token)?.followMap).toBe(false);
  view.unmount();
  mock.area = { west: -9, east: -8, south: 40, north: 42 };
  const restored = render(<Discovery {...props} />);
  await waitFor(() =>
    expect(
      (
        restored.getByRole("checkbox", {
          name: "Follow map",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false),
  );
  expect(mock.props!.restoreCamera).toEqual({
    longitude: -8.5,
    latitude: 41,
    zoom: 8,
  });
  expect(restored.getByRole("heading", { level: 1 }).textContent).toBe(
    "3 festivals",
  );
  fireEvent.click(restored.getByRole("checkbox", { name: "Follow map" }));
  expect(restored.getByRole("heading", { level: 1 }).textContent).toBe(
    "1 festival in map area",
  );
  expect(
    restored.getByRole("button", { name: /^Show on map: Porto Festival/ }),
  ).toBeTruthy();
});

test("an unavailable map keeps all rows and the follow preference", async () => {
  mock.area = null;
  const { view } = await setup();
  const checkbox = view.getByRole("checkbox", {
    name: "Follow map",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  expect(checkbox.disabled).toBe(true);
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "3 festivals",
  );
  act(() =>
    mock.props!.onAreaChange({ west: -10, east: -9, south: 38, north: 39 }),
  );
  expect(checkbox.disabled).toBe(false);
  act(() => mock.props!.onAreaChange(null));
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "3 festivals",
  );
  expect(checkbox.checked).toBe(true);
});

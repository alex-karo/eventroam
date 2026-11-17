// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { DiscoveryMap } from "./discovery-map";

const mock = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  const handlers: Record<string, (event: Data) => void> = {};
  const area = { west: -10, east: 0, south: 30, north: 40 };
  let loaded = false;
  const move = (data: Data = {}) => handlers.moveend?.(data);
  const source = {
    setData: vi.fn(),
    getClusterExpansionZoom: vi.fn((_id, cb) => cb(null, 8)),
  };
  const map = {
    on: vi.fn(
      (
        event: string,
        layerOrHandler: string | ((event: Data) => void),
        handler?: (event: Data) => void,
      ) => {
        handlers[event] =
          typeof layerOrHandler === "function" ? layerOrHandler : handler!;
      },
    ),
    addSource: vi.fn(() => {
      loaded = true;
    }),
    addLayer: vi.fn(),
    getSource: vi.fn(() => (loaded ? source : undefined)),
    getLayer: vi.fn(() => loaded),
    getBounds: vi.fn(() => ({
      getWest: () => area.west,
      getEast: () => area.east,
      getSouth: () => area.south,
      getNorth: () => area.north,
    })),
    getCenter: vi.fn(() => ({ lng: -5, lat: 35 })),
    getZoom: vi.fn(() => 5),
    fitBounds: vi.fn(() => move()),
    jumpTo: vi.fn(() => move()),
    panTo: vi.fn(() => move()),
    resize: vi.fn(() => move()),
    easeTo: vi.fn((_options, data) => move(data)),
    zoomIn: vi.fn((_options, data) => move(data)),
    zoomOut: vi.fn((_options, data) => move(data)),
    queryRenderedFeatures: vi.fn(() => [
      {
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { cluster_id: 1 },
      },
    ]),
    setPaintProperty: vi.fn(),
    remove: vi.fn(),
  };
  const overlay = {
    remove: vi.fn(),
  };
  return {
    map,
    handlers,
    area,
    reset: () => {
      loaded = false;
      Object.assign(area, { west: -10, east: 0, south: 30, north: 40 });
    },
    Map: vi.fn(function () {
      return map;
    }),
    Overlay: vi.fn(function () {
      return overlay;
    }),
  };
});
vi.mock("mapbox-gl", () => ({
  default: {
    Map: mock.Map,
    Marker: mock.Overlay,
    Popup: mock.Overlay,
    supported: () => true,
  },
}));

beforeEach(() => {
  mock.reset();
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "local-test-token");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function setup(located = true) {
  const row = testFixtures().build.summary({
    latitude: located ? 35 : null,
    longitude: located ? -5 : null,
  });
  const props = {
    summaries: [row],
    selectedId: null,
    onSelect: vi.fn(),
    cardRef: { current: null },
    restoreCamera: null,
    preserveSelectionCamera: true,
    onCameraChange: vi.fn(),
    onCameraInteraction: vi.fn(),
    followMap: true,
    onAreaChange: vi.fn(),
  };
  const view = render(<DiscoveryMap {...props} />);
  await waitFor(() => expect(mock.Map).toHaveBeenCalledTimes(1));
  act(() => mock.handlers.load({}));
  expect(props.onAreaChange).toHaveBeenLastCalledWith(mock.area);
  props.onAreaChange.mockClear();
  return { props, view };
}

test("only completed user movement changes the area; resize and programmatic pans still save the camera", async () => {
  const { props } = await setup();
  act(() => mock.handlers.movestart({ originalEvent: { type: "mousedown" } }));
  expect(props.onAreaChange).not.toHaveBeenCalled();
  Object.assign(mock.area, { west: 10, east: 20 });
  act(() => mock.handlers.moveend({ originalEvent: { type: "mouseup" } }));
  expect(props.onAreaChange).toHaveBeenCalledExactlyOnceWith(mock.area);
  props.onAreaChange.mockClear();
  for (const type of ["resize", "orientationchange", "fullscreenchange"]) {
    act(() => mock.handlers.moveend({ originalEvent: { type } }));
  }
  act(() => {
    mock.map.resize();
    mock.map.panTo();
  });
  expect(props.onAreaChange).not.toHaveBeenCalled();
  expect(props.onCameraChange).toHaveBeenLastCalledWith({
    longitude: -5,
    latitude: 35,
    zoom: 5,
  });
});

test("zoom controls and cluster expansion report their areas", async () => {
  const { props, view } = await setup();
  fireEvent.click(view.getByRole("button", { name: "Zoom in" }));
  fireEvent.click(view.getByRole("button", { name: "Zoom out" }));
  act(() => mock.handlers.click({ point: { x: 0, y: 0 } }));
  expect(props.onAreaChange).toHaveBeenCalledTimes(3);
  expect(mock.map.easeTo).toHaveBeenCalledWith(
    { center: [0, 0], zoom: 8 },
    { followMapArea: true },
  );
});

test("enabling follow and restoring a camera read fresh bounds without remounting the map", async () => {
  const { props, view } = await setup();
  view.rerender(<DiscoveryMap {...props} followMap={false} />);
  Object.assign(mock.area, { west: 20, east: 30 });
  view.rerender(<DiscoveryMap {...props} />);
  expect(props.onAreaChange).toHaveBeenLastCalledWith(mock.area);
  props.onAreaChange.mockClear();
  const onCameraChange = vi.fn();
  view.rerender(
    <DiscoveryMap
      {...props}
      onCameraChange={onCameraChange}
      restoreCamera={{ longitude: 25, latitude: 35, zoom: 5 }}
    />,
  );
  expect(onCameraChange).toHaveBeenCalledTimes(1);
  expect(props.onAreaChange).toHaveBeenCalledExactlyOnceWith(mock.area);
  expect(mock.Map).toHaveBeenCalledTimes(1);
});

test("initial unlocated results still report an area and map failure removes it", async () => {
  const { props, view } = await setup(false);
  act(() => mock.handlers.error({}));
  expect(props.onAreaChange).toHaveBeenLastCalledWith(null);
  expect(view.getByRole("status").textContent).toContain("Map could not load");
  act(() => mock.handlers.moveend({ originalEvent: { type: "wheel" } }));
  expect(props.onAreaChange).toHaveBeenLastCalledWith(null);
});

test("missing map configuration reports an unavailable area", () => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
  const onAreaChange = vi.fn();
  render(
    <DiscoveryMap
      summaries={[]}
      selectedId={null}
      onSelect={vi.fn()}
      cardRef={{ current: null }}
      restoreCamera={null}
      preserveSelectionCamera={false}
      onCameraChange={vi.fn()}
      onCameraInteraction={vi.fn()}
      followMap={true}
      onAreaChange={onAreaChange}
    />,
  );
  expect(onAreaChange).toHaveBeenCalledWith(null);
  expect(mock.Map).not.toHaveBeenCalled();
});

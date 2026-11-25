"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import type mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import { dateRange } from "@/components/catalog/format";
import { Icon } from "@/components/catalog/icons";
import type { Camera } from "@/site/discovery-context";
import type { MapArea } from "../model/map-area";
import { selectionOffset } from "./selection-visibility";
import styles from "./discovery-map.module.css";

type Props = {
  summaries: DiscoverySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  cardRef: RefObject<HTMLElement | null>;
  restoreCamera: Camera | null;
  preserveSelectionCamera: boolean;
  onCameraChange: (camera: Camera) => void;
  onCameraInteraction: () => void;
  followMap: boolean;
  onAreaChange: (area: MapArea | null) => void;
};

function isAreaMovement(event: {
  originalEvent?: { type: string };
  followMapArea?: boolean;
}) {
  const original = event.originalEvent;
  return (
    event.followMapArea === true ||
    Boolean(
      original &&
      ![
        "resize",
        "orientationchange",
        "fullscreenchange",
        "webkitfullscreenchange",
      ].includes(original.type),
    )
  );
}

export function hasMapPoint(summary: DiscoverySummary) {
  return summary.latitude !== null && summary.longitude !== null;
}

export function mapFeatures(
  summaries: DiscoverySummary[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: summaries.filter(hasMapPoint).map((summary) => ({
      type: "Feature",
      id: summary.id,
      geometry: {
        type: "Point",
        coordinates: [summary.longitude!, summary.latitude!],
      },
      properties: {
        id: summary.id,
      },
    })),
  };
}

// Choose the shorter longitude arc so locations either side of the date line fit together.
export function mapBounds(summaries: DiscoverySummary[]) {
  const located = summaries.filter(hasMapPoint);
  if (located.length === 0) {
    return null;
  }
  const longitudes = located
    .map((summary) => (((summary.longitude! + 180) % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let largestGap = -1;
  let afterGap = 0;
  for (let i = 0; i < longitudes.length; i++) {
    const next =
      i === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[i + 1];
    const gap = next - longitudes[i];
    if (gap > largestGap) {
      largestGap = gap;
      afterGap = (i + 1) % longitudes.length;
    }
  }
  const west = longitudes[afterGap] - 180;
  const east = west + 360 - largestGap;
  return {
    west,
    east,
    south: Math.min(...located.map((summary) => summary.latitude!)),
    north: Math.max(...located.map((summary) => summary.latitude!)),
  };
}

function previewContent(summary: DiscoverySummary) {
  const content = document.createElement("div");
  content.className = styles.previewContent;
  const name = document.createElement("strong");
  name.textContent = summary.eventName;
  content.append(name);
  const dates = document.createElement("span");
  dates.textContent = dateRange(summary.startsOn, summary.endsOn);
  content.append(dates);
  if (summary.dateState === "provisional") {
    const status = document.createElement("span");
    status.textContent = "Tentative dates";
    content.append(status);
  }
  return content;
}

function updateEditionPreview(
  instance: mapboxgl.Map | null,
  preview: mapboxgl.Popup | null,
  summary: DiscoverySummary | undefined,
) {
  if (!instance || !preview || !summary || !hasMapPoint(summary)) {
    preview?.remove();
    return;
  }
  preview
    .setLngLat([summary.longitude!, summary.latitude!])
    .setDOMContent(previewContent(summary))
    .addTo(instance);
}

function placeSelectedMarker(
  instance: mapboxgl.Map | null,
  marker: mapboxgl.Marker | null,
  summary: DiscoverySummary | undefined,
) {
  if (!instance || !summary || !hasMapPoint(summary)) {
    marker?.remove();
    return null;
  }
  const longitude =
    summary.longitude! +
    360 * Math.round((instance.getCenter().lng - summary.longitude!) / 360);
  const coords: [number, number] = [longitude, summary.latitude!];
  marker?.setLngLat(coords).addTo(instance);
  return coords;
}

function selectionViewport(
  element: HTMLDivElement,
  rect: DOMRect,
  wide: boolean,
) {
  const workspace = element.closest(".discovery-stage");
  const resultsRect = workspace
    ?.querySelector(".results-panel")
    ?.getBoundingClientRect();
  const controlsRect = workspace
    ?.querySelector(".discovery-controls")
    ?.getBoundingClientRect();
  const monthsRect = workspace
    ?.querySelector(".discovery-months")
    ?.getBoundingClientRect();
  return {
    left:
      wide && resultsRect ? Math.max(rect.left, resultsRect.right) : rect.left,
    right: rect.right,
    top:
      wide && controlsRect ? Math.max(rect.top, controlsRect.bottom) : rect.top,
    bottom:
      wide && monthsRect ? Math.min(rect.bottom, monthsRect.top) : rect.bottom,
  };
}

function panSelectionIntoView(
  instance: mapboxgl.Map | null,
  element: HTMLDivElement | null,
  coords: [number, number] | null,
  cardRef: RefObject<HTMLElement | null>,
) {
  if (!instance || !element?.clientWidth || !element.clientHeight || !coords) {
    return;
  }
  // The card can change the container size before its observer runs.
  instance.resize();
  const rect = element.getBoundingClientRect();
  const projected = instance.project(coords);
  const wide = window.matchMedia("(min-width: 741px)").matches;
  const viewport = selectionViewport(element, rect, wide);
  const card = cardRef.current;
  const cardRect = card?.getClientRects().length
    ? card.getBoundingClientRect()
    : null;
  const obstruction = wide
    ? cardRect
    : element.parentElement
        ?.querySelector('[aria-label="Map controls"]')
        ?.getBoundingClientRect();
  const offset = selectionOffset(
    { x: projected.x + rect.left, y: projected.y + rect.top },
    viewport,
    obstruction ?? null,
  );
  if (Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5) {
    instance.panTo(coords, {
      offset: [
        projected.x - offset.x - element.clientWidth / 2,
        projected.y - offset.y - element.clientHeight / 2,
      ],
      duration: 0,
    });
  }
}

function editionLocationChanged(
  id: string | null,
  previousSummaries: DiscoverySummary[],
  nextSummaries: DiscoverySummary[],
) {
  const previous = previousSummaries.find((item) => item.id === id);
  const next = nextSummaries.find((item) => item.id === id);
  return (
    previous &&
    next &&
    (previous.latitude !== next.latitude ||
      previous.longitude !== next.longitude)
  );
}

function readMapArea(instance: mapboxgl.Map | null): MapArea | null {
  const bounds = instance?.getSource("editions") ? instance.getBounds() : null;
  if (!bounds) {
    return null;
  }
  return {
    west: bounds.getWest(),
    east: bounds.getEast(),
    south: bounds.getSouth(),
    north: bounds.getNorth(),
  };
}

function fitMapToResults(
  instance: mapboxgl.Map,
  element: HTMLDivElement,
  bounds: NonNullable<ReturnType<typeof mapBounds>>,
) {
  instance.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    {
      padding: {
        top: Math.min(110, Math.max(20, element.clientHeight / 6)),
        right: Math.min(64, element.clientWidth / 8),
        bottom: Math.min(80, element.clientHeight / 6),
        left: window.matchMedia("(min-width: 741px)").matches
          ? Math.min(
              instance.getContainer().clientWidth / 2,
              Number.parseFloat(
                getComputedStyle(
                  instance.getContainer().closest(".discovery")!,
                ).getPropertyValue("--results-width"),
              ) + 48,
            )
          : 40,
      },
      maxZoom:
        bounds.west === bounds.east && bounds.south === bounds.north ? 5 : 7,
      retainPadding: false,
      duration: 0,
    },
  );
}

function jumpToCamera(instance: mapboxgl.Map, camera: Camera) {
  instance.jumpTo({
    center: [camera.longitude, camera.latitude],
    zoom: camera.zoom,
  });
}

function useMapCamera(
  map: RefObject<mapboxgl.Map | null>,
  container: RefObject<HTMLDivElement | null>,
  latestSummaries: RefObject<DiscoverySummary[]>,
  {
    restoreCamera,
    preserveSelectionCamera,
    onCameraInteraction,
  }: Pick<
    Props,
    "restoreCamera" | "preserveSelectionCamera" | "onCameraInteraction"
  >,
) {
  const initialFitPending = useRef(true);
  const cameraToRestore = useRef(restoreCamera);
  const cameraInteracted = useRef(onCameraInteraction);
  const preserveCamera = useRef(preserveSelectionCamera);

  useEffect(() => {
    preserveCamera.current = preserveSelectionCamera;
  }, [preserveSelectionCamera]);
  useEffect(() => {
    cameraInteracted.current = onCameraInteraction;
  }, [onCameraInteraction]);

  const preserveCurrentCamera = useCallback(() => {
    preserveCamera.current = true;
    cameraInteracted.current();
  }, []);
  const shouldPreserveCamera = useCallback(() => preserveCamera.current, []);
  const isInitialFitPending = useCallback(() => initialFitPending.current, []);
  const fitInitially = useCallback(() => {
    const instance = map.current;
    const element = container.current;
    if (
      !initialFitPending.current ||
      !instance?.getSource("editions") ||
      !element?.clientWidth ||
      !element.clientHeight
    ) {
      return false;
    }

    const camera = cameraToRestore.current;
    const bounds = camera ? null : mapBounds(latestSummaries.current);
    initialFitPending.current = false;
    if (camera) {
      jumpToCamera(instance, camera);
    } else if (bounds) {
      fitMapToResults(instance, element, bounds);
    }
    return true;
  }, [map, container, latestSummaries]);

  const restoreIfReady = useCallback(
    (camera: Camera | null) => {
      cameraToRestore.current = camera;
      const instance = map.current;
      if (!camera || !instance?.getSource("editions")) {
        return false;
      }
      initialFitPending.current = false;
      jumpToCamera(instance, camera);
      return true;
    },
    [map],
  );

  return {
    isInitialFitPending,
    shouldPreserveCamera,
    preserveCurrentCamera,
    fitInitially,
    restoreIfReady,
  };
}

function selectedPointRadius(
  selectedId: string | null,
): mapboxgl.ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedId ?? ""], 6, 4.5];
}

function addEditionLayers(
  instance: mapboxgl.Map,
  summaries: DiscoverySummary[],
  selectedId: string | null,
) {
  instance.addSource("editions", {
    type: "geojson",
    data: mapFeatures(summaries),
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 32,
  });
  instance.addLayer({
    id: "clusters",
    type: "circle",
    source: "editions",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#5144b5",
      "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 50, 18],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });
  instance.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "editions",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 10,
    },
    paint: { "text-color": "#ffffff" },
  });
  instance.addLayer({
    id: "cluster-hit-targets",
    type: "circle",
    source: "editions",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#000000",
      "circle-opacity": 0,
      "circle-radius": 22,
    },
  });
  instance.addLayer({
    id: "points",
    type: "circle",
    source: "editions",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#5144b5",
      "circle-radius": selectedPointRadius(selectedId),
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });
  // An invisible circle keeps the visual point small but gives it a usable target.
  instance.addLayer({
    id: "point-hit-targets",
    type: "circle",
    source: "editions",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#000000",
      "circle-opacity": 0,
      "circle-radius": 22,
    },
  });
}

function bindEditionInteractions(
  instance: mapboxgl.Map,
  onSelect: (id: string) => void,
  onPreview: (id: string | null) => void,
) {
  const nearestFeature = (point: mapboxgl.Point) => {
    const features = instance.queryRenderedFeatures(point, {
      layers: ["point-hit-targets", "cluster-hit-targets"],
    });
    const distance = (feature: (typeof features)[number]) => {
      const coordinates = (feature.geometry as Point).coordinates;
      const projected = instance.project(coordinates as [number, number]);
      return (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
    };
    return (
      features
        .filter((feature) => feature.geometry.type === "Point")
        .sort((a, b) => distance(a) - distance(b))[0] ?? null
    );
  };
  function expandCluster(
    source: mapboxgl.GeoJSONSource,
    clusterId: number,
    center: [number, number],
  ) {
    source.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (!error && zoom !== null && zoom !== undefined) {
        instance.easeTo({ center, zoom }, { followMapArea: true });
      }
    });
  }
  instance.on("click", (event) => {
    const feature = nearestFeature(event.point);
    if (!feature) {
      return;
    }
    const clusterId = feature.properties?.cluster_id;
    if (typeof clusterId === "number") {
      const source = instance.getSource("editions") as mapboxgl.GeoJSONSource;
      const center = (feature.geometry as Point).coordinates as [
        number,
        number,
      ];
      expandCluster(source, clusterId, center);
      return;
    }
    const id = feature.properties?.id;
    if (typeof id === "string") {
      onSelect(id);
    }
  });
  instance.on("mousemove", "point-hit-targets", (event) => {
    const id = nearestFeature(event.point)?.properties?.id;
    if (typeof id === "string") {
      onPreview(id);
    }
  });
  instance.on("mouseleave", "point-hit-targets", () => {
    onPreview(null);
  });
  for (const layer of ["point-hit-targets", "cluster-hit-targets"]) {
    instance.on("mouseenter", layer, () => {
      instance.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", layer, () => {
      instance.getCanvas().style.cursor = "";
    });
  }
}

function useDiscoveryMap({
  summaries,
  selectedId,
  onSelect,
  cardRef,
  restoreCamera,
  preserveSelectionCamera,
  onCameraChange,
  onCameraInteraction,
  followMap,
  onAreaChange,
}: Readonly<Props>) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const select = useEffectEvent(onSelect);
  const latestSummaries = useRef(summaries);
  const latestSelected = useRef(selectedId);
  const selectedMarker = useRef<mapboxgl.Marker | null>(null);
  const cameraChanged = useEffectEvent(onCameraChange);
  const {
    isInitialFitPending,
    shouldPreserveCamera,
    preserveCurrentCamera,
    fitInitially,
    restoreIfReady,
  } = useMapCamera(map, container, latestSummaries, {
    restoreCamera,
    preserveSelectionCamera,
    onCameraInteraction,
  });
  const updateSelectedMarker = useCallback(() => {
    const instance = map.current;
    const summary = latestSummaries.current.find(
      (item) => item.id === latestSelected.current,
    );
    return placeSelectedMarker(instance, selectedMarker.current, summary);
  }, []);
  const revealSelection = useCallback(() => {
    const coords = updateSelectedMarker();
    if (!shouldPreserveCamera()) {
      panSelectionIntoView(map.current, container.current, coords, cardRef);
    }
  }, [cardRef, shouldPreserveCamera, updateSelectedMarker]);
  const [error, setError] = useState<string | null>(null);
  const reportArea = useEffectEvent(() => {
    onAreaChange(
      error || isInitialFitPending() ? null : readMapArea(map.current),
    );
  });
  useEffect(() => {
    if (
      selectedId === latestSelected.current &&
      editionLocationChanged(selectedId, latestSummaries.current, summaries)
    ) {
      // A catalog refresh can also resize the map when its error notice closes.
      preserveCurrentCamera();
    }
    latestSummaries.current = summaries;
  }, [summaries, selectedId, preserveCurrentCamera]);
  useEffect(() => {
    latestSelected.current = selectedId;
  }, [selectedId]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const style =
    process.env.NEXT_PUBLIC_MAPBOX_STYLE ||
    "mapbox://styles/mapbox/streets-v12";
  useEffect(() => {
    reportArea();
  }, [followMap, error, token]);

  function showPreview(id: string | null) {
    if (id !== null && latestSelected.current) {
      return;
    }
    const summary =
      id === null
        ? undefined
        : latestSummaries.current.find((item) => item.id === id);
    updateEditionPreview(map.current, popup.current, summary);
  }

  useEffect(() => {
    if (!token || !container.current) {
      return;
    }
    let disposed = false;
    let instance: mapboxgl.Map | null = null;
    let observer: ResizeObserver | null = null;
    async function start() {
      try {
        const gl = (await import("mapbox-gl")).default;
        if (disposed || !container.current) {
          return;
        }
        if (!gl.supported()) {
          throw new Error("WebGL is unavailable.");
        }
        gl.accessToken = token!;
        instance = new gl.Map({
          container: container.current,
          style,
          center: [0, 20],
          zoom: 1.25,
          attributionControl: true,
        });
        map.current = instance;
        const markerElement = document.createElement("div");
        markerElement.className = "selected-map-point";
        markerElement.setAttribute("aria-hidden", "true");
        selectedMarker.current = new gl.Marker({ element: markerElement });
        instance.on("movestart", (event) => {
          if (isAreaMovement(event)) {
            preserveCurrentCamera();
          }
        });
        instance.on("moveend", (event) => {
          if (!instance || isInitialFitPending()) {
            return;
          }
          const center = instance.getCenter();
          cameraChanged({
            longitude: center.lng,
            latitude: center.lat,
            zoom: instance.getZoom(),
          });
          if (isAreaMovement(event)) {
            reportArea();
          }
        });
        popup.current = new gl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: styles.previewPopup,
        });
        observer = new ResizeObserver(() => {
          instance?.resize();
          if (fitInitially()) {
            reportArea();
          }
          revealSelection();
        });
        observer.observe(container.current);
        instance.on("error", () =>
          setError("Map could not load. Use the list to explore editions."),
        );
        instance.on("load", () => {
          if (!instance || disposed) {
            return;
          }
          addEditionLayers(
            instance,
            latestSummaries.current,
            latestSelected.current,
          );
          bindEditionInteractions(instance, (id) => select(id), showPreview);
          fitInitially();
          reportArea();
          showPreview(null);
          revealSelection();
          setError(null);
        });
      } catch {
        setError("Map is unavailable. Use the list to explore editions.");
      }
    }
    void start();
    return () => {
      disposed = true;
      observer?.disconnect();
      popup.current?.remove();
      popup.current = null;
      selectedMarker.current?.remove();
      selectedMarker.current = null;
      instance?.remove();
      map.current = null;
    };
    // The map instance persists through filter and view changes.
  }, [
    token,
    style,
    fitInitially,
    isInitialFitPending,
    revealSelection,
    preserveCurrentCamera,
  ]);

  useEffect(() => {
    const source = map.current?.getSource<mapboxgl.GeoJSONSource>("editions");
    source?.setData(mapFeatures(summaries));
    if (fitInitially()) {
      reportArea();
    }
    showPreview(null);
    updateSelectedMarker();
  }, [summaries, fitInitially, updateSelectedMarker]);
  useEffect(() => {
    const instance = map.current;
    if (instance?.getLayer("points")) {
      instance.setPaintProperty(
        "points",
        "circle-radius",
        selectedPointRadius(selectedId),
      );
    }
    showPreview(null);
    revealSelection();
    const observer = new ResizeObserver(revealSelection);
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, [selectedId, preserveSelectionCamera, cardRef, revealSelection]);
  useEffect(() => {
    if (restoreIfReady(restoreCamera)) {
      reportArea();
    }
  }, [restoreCamera, restoreIfReady]);

  return {
    container,
    configured: Boolean(token),
    error,
    zoomIn() {
      preserveCurrentCamera();
      map.current?.zoomIn({}, { followMapArea: true });
    },
    zoomOut() {
      preserveCurrentCamera();
      map.current?.zoomOut({}, { followMapArea: true });
    },
  };
}

export function DiscoveryMap(props: Readonly<Props>) {
  const { container, configured, error, zoomIn, zoomOut } =
    useDiscoveryMap(props);

  if (!configured) {
    return (
      <div className="map-fallback" role="status">
        Map is not configured. Explore editions in the list.
      </div>
    );
  }
  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" aria-label="Festival map" />
      {!error && (
        <div className={styles.controls} role="group" aria-label="Map controls">
          <button type="button" onClick={zoomIn} aria-label="Zoom in">
            <Icon name="plus" />
          </button>
          <button type="button" onClick={zoomOut} aria-label="Zoom out">
            <Icon name="minus" />
          </button>
        </div>
      )}
      {error && (
        <div className="map-fallback" role="status">
          {error}
        </div>
      )}
    </div>
  );
}

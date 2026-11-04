"use client";

import {
  useCallback,
  useEffect,
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
};

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

export function DiscoveryMap({
  summaries,
  selectedId,
  onSelect,
  cardRef,
  restoreCamera,
  preserveSelectionCamera,
  onCameraChange,
  onCameraInteraction,
}: Readonly<Props>) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const select = useRef(onSelect);
  const latestSummaries = useRef(summaries);
  const latestSelected = useRef(selectedId);
  const initialFitPending = useRef(true);
  const selectedMarker = useRef<mapboxgl.Marker | null>(null);
  const cameraToRestore = useRef(restoreCamera);
  const cameraChanged = useRef(onCameraChange);
  const cameraInteracted = useRef(onCameraInteraction);
  const preserveCamera = useRef(preserveSelectionCamera);
  useEffect(() => {
    preserveCamera.current = preserveSelectionCamera;
  }, [preserveSelectionCamera]);
  useEffect(() => {
    cameraChanged.current = onCameraChange;
  }, [onCameraChange]);
  useEffect(() => {
    cameraInteracted.current = onCameraInteraction;
  }, [onCameraInteraction]);
  const preserveManualCamera = useCallback(() => {
    preserveCamera.current = true;
    cameraInteracted.current();
  }, []);
  const updateSelectedMarker = useCallback(() => {
    const instance = map.current;
    const summary = latestSummaries.current.find(
      (item) => item.id === latestSelected.current,
    );
    if (!instance || !summary || !hasMapPoint(summary)) {
      selectedMarker.current?.remove();
      return null;
    }
    const longitude =
      summary.longitude! +
      360 * Math.round((instance.getCenter().lng - summary.longitude!) / 360);
    const coords: [number, number] = [longitude, summary.latitude!];
    selectedMarker.current?.setLngLat(coords).addTo(instance);
    return coords;
  }, []);
  const revealSelection = useCallback(() => {
    const coords = updateSelectedMarker();
    const instance = map.current;
    const element = container.current;
    if (
      !instance ||
      !element ||
      !coords ||
      preserveCamera.current ||
      !element.clientWidth ||
      !element.clientHeight
    ) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const projected = instance.project(coords);
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
    const wide = window.matchMedia("(min-width: 741px)").matches;
    const available = {
      left:
        wide && resultsRect
          ? Math.max(rect.left, resultsRect.right)
          : rect.left,
      right: rect.right,
      top:
        wide && controlsRect
          ? Math.max(rect.top, controlsRect.bottom)
          : rect.top,
      bottom:
        wide && monthsRect
          ? Math.min(rect.bottom, monthsRect.top)
          : rect.bottom,
    };
    const card = cardRef.current;
    const offset = selectionOffset(
      { x: projected.x + rect.left, y: projected.y + rect.top },
      available,
      card?.getClientRects().length ? card.getBoundingClientRect() : null,
    );
    if (Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5) {
      instance.panBy([offset.x, offset.y], { duration: 0 });
    }
  }, [cardRef, updateSelectedMarker]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    latestSummaries.current = summaries;
  }, [summaries]);
  useEffect(() => {
    latestSelected.current = selectedId;
  }, [selectedId]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const style =
    process.env.NEXT_PUBLIC_MAPBOX_STYLE ||
    "mapbox://styles/mapbox/streets-v12";

  function showPreview(id: string | null) {
    const summary = latestSummaries.current.find((item) => item.id === id);
    const instance = map.current;
    const preview = popup.current;
    if (
      latestSelected.current ||
      !summary ||
      !hasMapPoint(summary) ||
      !instance ||
      !preview
    ) {
      preview?.remove();
      return;
    }
    preview
      .setLngLat([summary.longitude!, summary.latitude!])
      .setDOMContent(previewContent(summary))
      .addTo(instance);
  }

  const fitResults = useCallback(() => {
    const instance = map.current;
    const bounds = mapBounds(latestSummaries.current);
    if (!instance || !bounds) {
      return;
    }
    initialFitPending.current = false;
    instance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      {
        padding: {
          top: Math.min(
            110,
            Math.max(20, (container.current?.clientHeight ?? 400) / 6),
          ),
          right: Math.min(64, (container.current?.clientWidth ?? 400) / 8),
          bottom: Math.min(80, (container.current?.clientHeight ?? 400) / 6),
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
  }, []);

  const fitInitially = useCallback(() => {
    if (
      initialFitPending.current &&
      map.current?.getSource("editions") &&
      container.current?.clientWidth &&
      container.current.clientHeight
    ) {
      if (cameraToRestore.current) {
        const camera = cameraToRestore.current;
        map.current.jumpTo({
          center: [camera.longitude, camera.latitude],
          zoom: camera.zoom,
        });
        initialFitPending.current = false;
      } else {
        fitResults();
      }
    }
  }, [fitResults]);

  useEffect(() => {
    if (!token || !container.current) {
      return;
    }
    let disposed = false;
    let instance: mapboxgl.Map | null = null;
    let observer: ResizeObserver | null = null;
    const nearestFeature = (point: mapboxgl.Point) => {
      if (!instance) {
        return null;
      }
      const features = instance.queryRenderedFeatures(point, {
        layers: ["point-hit-targets", "cluster-hit-targets"],
      });
      const distance = (feature: (typeof features)[number]) => {
        const coordinates = (feature.geometry as Point).coordinates;
        const projected = instance!.project(coordinates as [number, number]);
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
        if (!error && instance && zoom !== null && zoom !== undefined) {
          instance.easeTo({ center, zoom });
        }
      });
    }
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
          if (event.originalEvent) {
            preserveManualCamera();
          }
        });
        instance.on("moveend", () => {
          if (!instance || initialFitPending.current) {
            return;
          }
          const center = instance.getCenter();
          cameraChanged.current({
            longitude: center.lng,
            latitude: center.lat,
            zoom: instance.getZoom(),
          });
        });
        popup.current = new gl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: styles.previewPopup,
        });
        observer = new ResizeObserver(() => {
          instance?.resize();
          fitInitially();
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
          instance.addSource("editions", {
            type: "geojson",
            data: mapFeatures(latestSummaries.current),
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
              "circle-radius": [
                "step",
                ["get", "point_count"],
                11,
                10,
                14,
                50,
                18,
              ],
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
              "circle-radius": [
                "case",
                ["==", ["get", "id"], latestSelected.current ?? ""],
                6,
                4.5,
              ],
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
          instance.on("click", (event) => {
            const feature = nearestFeature(event.point);
            if (!feature || !instance) {
              return;
            }
            const clusterId = feature.properties?.cluster_id;
            if (typeof clusterId === "number") {
              const source = instance.getSource(
                "editions",
              ) as mapboxgl.GeoJSONSource;
              const center = (feature.geometry as Point).coordinates as [
                number,
                number,
              ];
              expandCluster(source, clusterId, center);
              return;
            }
            const id = feature.properties?.id;
            if (typeof id === "string") {
              select.current(id);
            }
          });
          instance.on("mousemove", "point-hit-targets", (event) => {
            const id = nearestFeature(event.point)?.properties?.id;
            if (typeof id === "string" && !latestSelected.current) {
              showPreview(id);
            }
          });
          instance.on("mouseleave", "point-hit-targets", () => {
            showPreview(null);
          });
          for (const layer of ["point-hit-targets", "cluster-hit-targets"]) {
            instance.on("mouseenter", layer, () => {
              if (instance) {
                instance.getCanvas().style.cursor = "pointer";
              }
            });
            instance.on("mouseleave", layer, () => {
              if (instance) {
                instance.getCanvas().style.cursor = "";
              }
            });
          }
          fitInitially();
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
  }, [token, style, fitInitially, revealSelection, preserveManualCamera]);

  useEffect(() => {
    const instance = map.current;
    if (instance?.getSource("editions")) {
      (instance.getSource("editions") as mapboxgl.GeoJSONSource).setData(
        mapFeatures(summaries),
      );
    }
    fitInitially();
    showPreview(null);
    updateSelectedMarker();
  }, [summaries, fitInitially, updateSelectedMarker]);
  useEffect(() => {
    const instance = map.current;
    if (instance?.getLayer("points")) {
      const selected = ["==", ["get", "id"], selectedId ?? ""];
      instance.setPaintProperty("points", "circle-radius", [
        "case",
        selected,
        6,
        4.5,
      ]);
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
    cameraToRestore.current = restoreCamera;
    if (restoreCamera && map.current) {
      initialFitPending.current = false;
      map.current.jumpTo({
        center: [restoreCamera.longitude, restoreCamera.latitude],
        zoom: restoreCamera.zoom,
      });
    }
  }, [restoreCamera]);

  if (!token) {
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
          <button
            type="button"
            onClick={() => {
              preserveManualCamera();
              map.current?.zoomIn();
            }}
            aria-label="Zoom in"
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            onClick={() => {
              preserveManualCamera();
              map.current?.zoomOut();
            }}
            aria-label="Zoom out"
          >
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

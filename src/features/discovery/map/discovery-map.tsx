"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import type mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import styles from "./discovery-map.module.css";

type Props = {
  summaries: DiscoverySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
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
        name: summary.name ?? `${summary.eventName} ${summary.year}`,
        approximate: summary.coordinatePrecision !== "exact",
        soldOut: summary.ticketAvailability === "sold_out",
      },
    })),
  };
}

// Choose the shorter longitude arc so locations either side of the date line fit together.
export function mapBounds(summaries: DiscoverySummary[]) {
  const located = summaries.filter(hasMapPoint);
  if (located.length === 0) return null;
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
  name.textContent = summary.name ?? `${summary.eventName} ${summary.year}`;
  content.append(name);
  const dates = document.createElement("span");
  dates.textContent = `${summary.startsOn}–${summary.endsOn}`;
  content.append(dates);
  const status = [
    summary.dateState === "provisional" ? "Tentative dates" : "Confirmed dates",
    summary.ticketAvailability === "sold_out" ? "Sold out" : null,
    summary.coordinatePrecision !== "exact" ? "Approximate location" : null,
  ].filter(Boolean);
  if (status.length) {
    const line = document.createElement("span");
    line.textContent = status.join(" · ");
    content.append(line);
  }
  return content;
}

export function DiscoveryMap({
  summaries,
  selectedId,
  onSelect,
  visible,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const select = useRef(onSelect);
  const latestSummaries = useRef(summaries);
  const latestSelected = useRef(selectedId);
  const initialFitPending = useRef(true);
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
    if (!summary || !hasMapPoint(summary) || !instance || !preview) {
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
    if (!instance || !bounds) return;
    initialFitPending.current = false;
    if (bounds.west === bounds.east && bounds.south === bounds.north) {
      instance.easeTo({
        center: [bounds.west, bounds.south],
        zoom: 5,
        duration: 0,
      });
      return;
    }
    instance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      {
        padding: {
          top: Math.min(
            110,
            Math.max(28, (container.current?.clientHeight ?? 400) / 4),
          ),
          right: 64,
          bottom: 80,
          left: 64,
        },
        maxZoom: 7,
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
    )
      fitResults();
  }, [fitResults]);

  useEffect(() => {
    if (!token || !container.current) return;
    let disposed = false;
    let instance: mapboxgl.Map | null = null;
    let observer: ResizeObserver | null = null;
    async function start() {
      try {
        const gl = (await import("mapbox-gl")).default;
        if (disposed || !container.current) return;
        if (!gl.supported()) throw new Error("WebGL is unavailable.");
        gl.accessToken = token!;
        instance = new gl.Map({
          container: container.current,
          style,
          center: [0, 20],
          zoom: 1.25,
          attributionControl: true,
        });
        map.current = instance;
        popup.current = new gl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: styles.previewPopup,
        });
        observer = new ResizeObserver(() => {
          instance?.resize();
          fitInitially();
        });
        observer.observe(container.current);
        instance.on("error", () =>
          setError("Map could not load. Use the list to explore editions."),
        );
        instance.on("load", () => {
          if (!instance || disposed) return;
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
              "circle-color": "#007969",
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
              "circle-color": [
                "case",
                ["==", ["get", "id"], latestSelected.current ?? ""],
                "#bd4f2e",
                "#007969",
              ],
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
          const nearestFeature = (point: mapboxgl.Point) => {
            if (!instance) return null;
            const features = instance.queryRenderedFeatures(point, {
              layers: ["point-hit-targets", "cluster-hit-targets"],
            });
            return (
              features
                .filter((feature) => feature.geometry.type === "Point")
                .sort((a, b) => {
                  const distance = (feature: (typeof features)[number]) => {
                    const coordinates = (feature.geometry as Point).coordinates;
                    const projected = instance!.project(
                      coordinates as [number, number],
                    );
                    return (
                      (projected.x - point.x) ** 2 +
                      (projected.y - point.y) ** 2
                    );
                  };
                  return distance(a) - distance(b);
                })[0] ?? null
            );
          };
          instance.on("click", (event) => {
            const feature = nearestFeature(event.point);
            if (!feature || !instance) return;
            const clusterId = feature.properties?.cluster_id;
            if (typeof clusterId === "number") {
              const source = instance.getSource(
                "editions",
              ) as mapboxgl.GeoJSONSource;
              const center = (feature.geometry as Point).coordinates as [
                number,
                number,
              ];
              source.getClusterExpansionZoom(clusterId, (error, zoom) => {
                if (!error && instance && zoom !== null && zoom !== undefined)
                  instance.easeTo({ center, zoom });
              });
              return;
            }
            const id = feature.properties?.id;
            if (typeof id === "string") select.current(id);
          });
          instance.on("mousemove", "point-hit-targets", (event) => {
            const id = nearestFeature(event.point)?.properties?.id;
            if (typeof id === "string" && !latestSelected.current)
              showPreview(id);
          });
          instance.on("mouseleave", "point-hit-targets", () => {
            showPreview(latestSelected.current);
          });
          for (const layer of ["point-hit-targets", "cluster-hit-targets"]) {
            instance.on("mouseenter", layer, () => {
              if (instance) instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layer, () => {
              if (instance) instance.getCanvas().style.cursor = "";
            });
          }
          fitInitially();
          showPreview(latestSelected.current);
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
      instance?.remove();
      map.current = null;
    };
    // The map instance persists through filter and view changes.
  }, [token, style, fitInitially]);

  useEffect(() => {
    const instance = map.current;
    if (instance?.getSource("editions"))
      (instance.getSource("editions") as mapboxgl.GeoJSONSource).setData(
        mapFeatures(summaries),
      );
    fitInitially();
    showPreview(latestSelected.current);
  }, [summaries, fitInitially]);
  useEffect(() => {
    const instance = map.current;
    if (instance?.getLayer("points")) {
      const selected = ["==", ["get", "id"], selectedId ?? ""];
      instance.setPaintProperty("points", "circle-color", [
        "case",
        selected,
        "#bd4f2e",
        "#007969",
      ]);
      instance.setPaintProperty("points", "circle-radius", [
        "case",
        selected,
        6,
        4.5,
      ]);
    }
    showPreview(selectedId);
  }, [selectedId]);
  useEffect(() => {
    if (visible) {
      map.current?.resize();
      fitInitially();
    }
  }, [visible, fitInitially]);

  if (!token)
    return (
      <div className="map-fallback" role="status">
        Map is not configured. Explore editions in the list.
      </div>
    );
  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" aria-label="Festival map" />
      {!error && (
        <div className={styles.controls} role="group" aria-label="Map controls">
          <button
            type="button"
            onClick={fitResults}
            title="Fit all mapped results"
          >
            Fit all
          </button>
          <button
            type="button"
            onClick={() => map.current?.zoomOut()}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => map.current?.zoomIn()}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      )}
      {error && (
        <div className="map-fallback" role="status">
          {error}
        </div>
      )}
      <p className="map-caption">
        Points may represent approximate locations. Select a result in the list
        for keyboard access.
      </p>
    </div>
  );
}

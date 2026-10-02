"use client";

import { useEffect, useRef, useState } from "react";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import type mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";

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

export function DiscoveryMap({
  summaries,
  selectedId,
  onSelect,
  visible,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const select = useRef(onSelect);
  const latestSummaries = useRef(summaries);
  const latestSelected = useRef(selectedId);
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

  useEffect(() => {
    if (!token || !container.current) return;
    let disposed = false;
    let instance: mapboxgl.Map | null = null;
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
            clusterRadius: 48,
          });
          instance.addLayer({
            id: "clusters",
            type: "circle",
            source: "editions",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#12614f",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                10,
                23,
                50,
                29,
              ],
            },
          });
          instance.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "editions",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
            },
            paint: { "text-color": "#ffffff" },
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
                "#12614f",
              ],
              "circle-radius": 9,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
          instance.addLayer({
            id: "approximate-labels",
            type: "symbol",
            source: "editions",
            filter: [
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "approximate"], true],
            ],
            layout: {
              "text-field": ["concat", ["get", "name"], " · approximate"],
              "text-size": 11,
              "text-offset": [0, 1.5],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#173d33",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            },
          });
          instance.on("click", "clusters", (event) => {
            const feature = instance?.queryRenderedFeatures(event.point, {
              layers: ["clusters"],
            })[0];
            const clusterId = feature?.properties?.cluster_id;
            const source = instance?.getSource("editions") as
              mapboxgl.GeoJSONSource | undefined;
            if (
              typeof clusterId !== "number" ||
              !source ||
              !instance ||
              feature?.geometry.type !== "Point"
            )
              return;
            const center = feature.geometry.coordinates as [number, number];
            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (!error && instance && zoom !== null && zoom !== undefined)
                instance.easeTo({ center, zoom });
            });
          });
          instance.on("click", "points", (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") select.current(id);
          });
          for (const layer of ["points", "clusters"]) {
            instance.on("mouseenter", layer, () => {
              if (instance) instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layer, () => {
              if (instance) instance.getCanvas().style.cursor = "";
            });
          }
          setError(null);
        });
      } catch {
        setError("Map is unavailable. Use the list to explore editions.");
      }
    }
    void start();
    return () => {
      disposed = true;
      instance?.remove();
      map.current = null;
    };
    // The map instance persists through filter and view changes.
  }, [token, style]);

  useEffect(() => {
    const instance = map.current;
    if (instance?.getSource("editions"))
      (instance.getSource("editions") as mapboxgl.GeoJSONSource).setData(
        mapFeatures(summaries),
      );
  }, [summaries]);
  useEffect(() => {
    const instance = map.current;
    if (instance?.getLayer("points"))
      instance.setPaintProperty("points", "circle-color", [
        "case",
        ["==", ["get", "id"], selectedId ?? ""],
        "#bd4f2e",
        "#12614f",
      ]);
  }, [selectedId]);
  useEffect(() => {
    if (visible) map.current?.resize();
  }, [visible]);

  if (!token)
    return (
      <div className="map-fallback" role="status">
        Map is not configured. Explore editions in the list.
      </div>
    );
  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" aria-label="Festival map" />
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

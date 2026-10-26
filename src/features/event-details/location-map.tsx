"use client";
import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

export function locationZoom(precision: string) {
  const zooms: Record<string, number> = {
    exact: 14,
    approximate: 11,
    locality: 9,
    region: 6,
    unknown: 5,
  };
  return zooms[precision] ?? zooms.unknown;
}
export function LocationMap({
  latitude,
  longitude,
  precision,
}: Readonly<{ latitude: number; longitude: number; precision: string }>) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  useEffect(() => {
    if (!token || !container.current) {
      return;
    }
    let disposed = false;
    let map: mapboxgl.Map | undefined;
    let marker: mapboxgl.Marker | undefined;
    let observer: ResizeObserver | undefined;
    async function start() {
      try {
        const gl = (await import("mapbox-gl")).default;
        if (disposed || !container.current) {
          return;
        }
        if (!gl.supported()) {
          throw new Error("Map unavailable");
        }
        map = new gl.Map({
          container: container.current,
          accessToken: token,
          style:
            process.env.NEXT_PUBLIC_MAPBOX_STYLE ||
            "mapbox://styles/mapbox/streets-v12",
          center: [longitude, latitude],
          zoom: locationZoom(precision),
          scrollZoom: false,
          attributionControl: true,
        });
        map.addControl(
          new gl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        marker = new gl.Marker({ color: "#151522" })
          .setLngLat([longitude, latitude])
          .addTo(map);
        map.on("error", () => setError(true));
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(container.current);
      } catch {
        if (!disposed) {
          setError(true);
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      observer?.disconnect();
      marker?.remove();
      map?.remove();
    };
  }, [token, latitude, longitude, precision]);
  return (
    <div className="edition-location-map">
      {token && (
        <div
          className="location-canvas"
          ref={container}
          aria-label="Edition location map"
        />
      )}
      {(!token || error) && (
        <p className="location-map-fallback" role="status">
          Map is unavailable. Use the external map link to view this location.
        </p>
      )}
    </div>
  );
}

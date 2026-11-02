import { coordinatePair, mapText } from "./maps";

interface MapPoint {
  name: string;
  description: string;
  coordinates: [number, number];
}
interface MapLayer {
  name: string;
  points: MapPoint[];
}
export interface MyMap {
  title: string;
  description: string;
  layers: MapLayer[];
  skippedGeometry: boolean;
}

function unsupported(): never {
  throw new Error("unsupported_map_data");
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : unsupported();
}
function optionalText(value: unknown): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : unsupported();
}

function parsePoint(feature: unknown[]): MapPoint {
  const locations = array(feature[1]);
  if (locations.length !== 1) {
    unsupported();
  }
  const position = array(locations[0]);
  if (position.length !== 1) {
    unsupported();
  }
  const coordinates = array(position[0]);
  if (coordinates.length !== 2) {
    unsupported();
  }
  const pair = coordinatePair(coordinates[0], coordinates[1]);
  if (!pair) {
    unsupported();
  }
  let name = "",
    description = "";
  for (const rawAttribute of array(feature[5])) {
    if (rawAttribute == null) {
      continue;
    }
    const attribute = array(rawAttribute);
    if (typeof attribute[0] !== "string") {
      continue;
    }
    const value = array(attribute[1])[0];
    if (typeof value !== "string") {
      continue;
    }
    if (attribute[0] === "description") {
      description = value;
    } else if (!name) {
      // The first text attribute is the label, also in localized maps.
      name = value;
    }
  }
  return { name, description, coordinates: pair };
}

function parseLayer(rawLayer: unknown): {
  layer: MapLayer;
  skippedGeometry: boolean;
} {
  const data = array(rawLayer);
  const layer: MapLayer = { name: optionalText(data[2]), points: [] };
  // Provider layout: layer[12][0][13][0] holds full geometry records.
  // layer[4] holds compact display records and is not a point source.
  const full = array(array(array(array(data[12])[0])[13])[0]);
  const seen = new Set<string>();
  let skippedGeometry = false;
  for (const rawFeature of full) {
    const feature = array(rawFeature);
    if (typeof feature[0] !== "string") {
      unsupported();
    }
    if (seen.has(feature[0])) {
      continue;
    }
    seen.add(feature[0]);
    if (feature[2] != null || feature[3] != null) {
      skippedGeometry = true;
    } else {
      layer.points.push(parsePoint(feature));
    }
  }
  return { layer, skippedGeometry };
}

export function parseMyMap(html: string): MyMap {
  const literal = /var _pageData\s*=\s*("(?:[^"\\]|\\.)*")/.exec(html)?.[1];
  if (!literal) {
    unsupported();
  }
  let data: unknown;
  try {
    data = JSON.parse(JSON.parse(literal));
  } catch {
    unsupported();
  }
  const map = array(array(data)[1]);
  const layers = array(map[6]).map(parseLayer);
  return {
    title: optionalText(map[2]),
    description: optionalText(map[16]),
    layers: layers.map((item) => item.layer),
    skippedGeometry: layers.some((item) => item.skippedGeometry),
  };
}

export function myMapMarkdown(map: MyMap): string {
  const lines = [
    map.title ? `Title: ${mapText(map.title)}` : "",
    map.description ? `Description: ${mapText(map.description)}` : "",
  ];
  let count = 0;
  for (const layer of map.layers) {
    lines.push(`### Layer: ${mapText(layer.name) || "Unnamed layer"}`);
    for (const point of layer.points) {
      const description = point.description
        ? " · " + mapText(point.description)
        : "";
      lines.push(
        `- ${mapText(point.name) || "Unnamed point"} · latitude: ${point.coordinates[0]} · longitude: ${point.coordinates[1]}${description}`,
      );
      count += 1;
    }
  }
  if (!count) {
    lines.push("No point markers were extracted.");
  }
  if (map.skippedGeometry) {
    lines.push("Lines and polygons were skipped.");
  }
  return lines.filter(Boolean).join("\n\n");
}

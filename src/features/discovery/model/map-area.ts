import type { DiscoverySummary } from "@/catalog/read/contracts";

export type MapArea = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function filterMapArea(
  summaries: DiscoverySummary[],
  area: MapArea,
): DiscoverySummary[] {
  const width = area.east - area.west;
  return summaries.filter(({ latitude, longitude }) => {
    if (
      latitude === null ||
      longitude === null ||
      latitude < area.south ||
      latitude > area.north
    ) {
      return false;
    }
    const offset = (((longitude - area.west) % 360) + 360) % 360;
    return width >= 360 || offset <= width;
  });
}

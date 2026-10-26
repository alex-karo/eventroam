import type { Point } from "./contracts";
export function distanceKm(a: Point, b: Point) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const value =
    Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}
type History = {
  id: string;
  eventId: string;
  latitude: number | null;
  longitude: number | null;
  startsOn: string | null;
  endsOn: string | null;
  editionYear: number | null;
};
function earlier(a: History, b: History) {
  if (a.endsOn && b.startsOn) {
    return a.endsOn < b.startsOn;
  }
  return (
    a.editionYear !== null &&
    b.editionYear !== null &&
    a.editionYear < b.editionYear
  );
}
export function previousPoint<T extends History>(target: History, saved: T[]) {
  const candidates = saved.filter(
    (item) =>
      item.eventId === target.eventId &&
      item.id !== target.id &&
      item.latitude !== null &&
      item.longitude !== null &&
      earlier(item, target),
  );
  const latest = candidates.filter((item) =>
    candidates.every((other) => item.id === other.id || earlier(other, item)),
  );
  return latest.length === 1 ? latest[0] : null;
}

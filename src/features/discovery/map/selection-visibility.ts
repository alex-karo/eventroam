type Rect = { left: number; top: number; right: number; bottom: number };
export function selectionOffset(
  point: { x: number; y: number },
  viewport: Rect,
  card: Rect | null,
) {
  const markerRadius = 15;
  // Mapbox rounds marker positions to whole CSS pixels.
  const clearance = 24 + markerRadius + 1;
  const safe = {
    left: viewport.left + 28,
    right: viewport.right - 28,
    top: viewport.top + 28,
    bottom: viewport.bottom - 52,
  };
  const offset = (rect: Rect) => ({
    x: point.x - Math.max(rect.left, Math.min(point.x, rect.right)),
    y: point.y - Math.max(rect.top, Math.min(point.y, rect.bottom)),
  });
  if (
    card &&
    card.left < safe.right &&
    card.right > safe.left &&
    card.top < safe.bottom &&
    card.bottom > safe.top
  ) {
    const options = [
      { ...safe, right: Math.min(safe.right, card.left - clearance) },
      { ...safe, left: Math.max(safe.left, card.right + clearance) },
      { ...safe, bottom: Math.min(safe.bottom, card.top - clearance) },
      { ...safe, top: Math.max(safe.top, card.bottom + clearance) },
    ];
    const offsets = options
      .filter((rect) => rect.right > rect.left && rect.bottom > rect.top)
      .map(offset);
    if (offsets.length) {
      const distance = (value: { x: number; y: number }) =>
        value.x ** 2 + value.y ** 2;
      return offsets.toSorted((a, b) => distance(a) - distance(b))[0];
    }
  }
  return offset(safe);
}

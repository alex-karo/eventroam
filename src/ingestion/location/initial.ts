import { editionSlotNames } from "../research/contracts";
import {
  geocodingKey,
  type GeocodingRequest,
} from "../tools/geocode/contracts";
import type { GeocodingSession } from "../tools/geocode/tool";
import type { LocationInput } from "./input";
export async function prepareInitialGeocoding(
  input: LocationInput,
  session: GeocodingSession,
) {
  const requests = new Map<
    string,
    { request: GeocodingRequest; slots: (typeof editionSlotNames)[number][] }
  >();
  const add = (
    request: GeocodingRequest,
    slot: (typeof editionSlotNames)[number],
  ) => {
    const key = geocodingKey(request);
    const existing = requests.get(key);
    if (existing) {
      existing.slots.push(slot);
    } else {
      requests.set(key, { request, slots: [slot] });
    }
  };
  for (const slot of editionSlotNames) {
    const target = input[slot];
    if (!target) {
      continue;
    }
    const old =
      target.saved?.latitude != null && target.saved.longitude != null
        ? target.saved
        : target.previousPoint;
    if (old?.latitude != null && old.longitude != null) {
      add(
        {
          direction: "reverse",
          latitude: old.latitude,
          longitude: old.longitude,
        },
        slot,
      );
    }
  }
  for (const { request, slots } of requests.values()) {
    await session.request(request, "initial", slots);
  }
}

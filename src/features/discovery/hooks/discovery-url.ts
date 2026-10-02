import {
  parseFilters,
  serializeFilters,
  type Filters,
} from "@/features/discovery/model/discovery";
import type { Genre } from "@/catalog/read/contracts";

export type DiscoveryView = "map" | "list";

function discoveryView(params: URLSearchParams): DiscoveryView {
  return params.get("view") === "map" ? "map" : "list";
}

export function readDiscoveryLocation(genres: Genre[]) {
  const params = new URLSearchParams(window.location.search);
  const view = discoveryView(params);
  try {
    return { view, filters: parseFilters(params, genres), error: null };
  } catch (caught) {
    return {
      view,
      filters: null,
      error: caught instanceof Error ? caught.message : "Invalid filters.",
    };
  }
}

function writeLocation(
  params: URLSearchParams,
  method: "pushState" | "replaceState",
) {
  const path = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
  if (
    method === "pushState" ||
    path !== `${window.location.pathname}${window.location.search}`
  )
    window.history[method](null, "", path);
}

function preserveView(params: URLSearchParams) {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "map" || view === "list") params.set("view", view);
  return params;
}

export function normalizeDiscoveryLocation(query: string) {
  writeLocation(preserveView(new URLSearchParams(query)), "replaceState");
}

export function pushDiscoveryFilters(filters: Filters) {
  writeLocation(preserveView(serializeFilters(filters)), "pushState");
}

export function pushDiscoveryView(view: DiscoveryView) {
  const params = new URLSearchParams(window.location.search);
  if (view === "map") params.set("view", view);
  else params.delete("view");
  writeLocation(params, "pushState");
}

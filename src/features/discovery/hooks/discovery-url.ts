import { newVisitToken } from "@/site/discovery-context";
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
  token?: string,
) {
  const query = params.size ? `?${params}` : "";
  const path = `${window.location.pathname}${query}`;
  if (
    method === "pushState" ||
    path !== `${window.location.pathname}${window.location.search}`
  ) {
    window.history[method](
      {
        ...window.history.state,
        ...(token ? { eventroamDiscovery: token } : {}),
      },
      "",
      path,
    );
  }
}

function pushLocation(params: URLSearchParams) {
  const token = newVisitToken();
  writeLocation(params, "pushState", token);
  return token;
}

function preserveView(params: URLSearchParams) {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "map" || view === "list") {
    params.set("view", view);
  }
  return params;
}

export function normalizeDiscoveryLocation(query: string) {
  writeLocation(preserveView(new URLSearchParams(query)), "replaceState");
}

export function pushDiscoveryFilters(filters: Filters) {
  return pushLocation(preserveView(serializeFilters(filters)));
}

export function pushDiscoveryView(view: DiscoveryView) {
  const params = new URLSearchParams(window.location.search);
  if (view === "map") {
    params.set("view", view);
  } else {
    params.delete("view");
  }
  return pushLocation(params);
}

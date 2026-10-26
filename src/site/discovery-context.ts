export type Camera = { longitude: number; latitude: number; zoom: number };
export type DiscoveryVisit = {
  rootUrl: string;
  camera: Camera | null;
  scroll: number;
  selectedId: string | null;
  expanded: boolean;
};
const stateKey = "eventroamDiscovery";
const storagePrefix = "eventroam:discovery:";
export function discoveryToken(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value)
    ? value
    : null;
}
export function withDiscovery(path: string, token?: string | null) {
  const separator = path.includes("?") ? "&" : "?";
  return token
    ? `${path}${separator}discovery=${encodeURIComponent(token)}`
    : path;
}
export function readVisit(token: string | null): DiscoveryVisit | null {
  if (!token) {
    return null;
  }
  try {
    const value = JSON.parse(
      sessionStorage.getItem(
        `${storagePrefix}${window.location.origin}:${token}`,
      ) ?? "null",
    );
    if (!value || typeof value.rootUrl !== "string") {
      return null;
    }
    const url = new URL(value.rootUrl, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.pathname !== "/" ||
      url.hash ||
      url.searchParams.has("discovery")
    ) {
      return null;
    }
    if (
      !Number.isFinite(value.scroll) ||
      value.scroll < 0 ||
      typeof value.expanded !== "boolean" ||
      !(value.selectedId === null || typeof value.selectedId === "string")
    ) {
      return null;
    }
    const c = value.camera;
    if (
      c !== null &&
      (!c ||
        !Number.isFinite(c.longitude) ||
        !Number.isFinite(c.latitude) ||
        !Number.isFinite(c.zoom) ||
        Math.abs(c.latitude) > 90 ||
        c.zoom < 0 ||
        c.zoom > 24)
    ) {
      return null;
    }
    return {
      rootUrl: `${url.pathname}${url.search}`,
      camera: c,
      scroll: value.scroll,
      selectedId: value.selectedId,
      expanded: value.expanded,
    };
  } catch {
    return null;
  }
}
export function historyVisitToken(): string | null {
  return discoveryToken(window.history.state?.[stateKey]);
}
export function newVisitToken() {
  return crypto.randomUUID();
}
export function saveVisit(token: string, visit: DiscoveryVisit) {
  try {
    sessionStorage.setItem(
      `${storagePrefix}${window.location.origin}:${token}`,
      JSON.stringify(visit),
    );
  } catch {
    /* Links remain usable when storage is disabled. */
  }
}
export function beginVisit() {
  const url = new URL(window.location.href);
  const explicitToken = discoveryToken(url.searchParams.get("discovery"));
  const token = explicitToken ?? historyVisitToken();
  url.searchParams.delete("discovery");
  const saved = readVisit(token);
  const rootUrl =
    explicitToken && saved && url.pathname === "/" && !url.search
      ? saved.rootUrl
      : `${url.pathname}${url.search}`;
  const visit = saved?.rootUrl === rootUrl ? saved : null;
  const nextToken = visit && token ? token : newVisitToken();
  window.history.replaceState(
    { ...window.history.state, [stateKey]: nextToken },
    "",
    rootUrl,
  );
  return { token: nextToken, visit };
}
export function returnHref(token: string | null) {
  const visit = readVisit(token);
  return visit ? withDiscovery(visit.rootUrl, token) : "/";
}

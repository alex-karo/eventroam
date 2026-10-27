import { load, type CheerioAPI } from "cheerio";

export interface MapReference {
  url: string;
  mid?: string;
  context: string[];
}

const text = (value: string) => value.replace(/\s+/g, " ").trim();

export function mapReference(
  href: string,
  baseUrl: string,
): MapReference | null {
  try {
    const url = new URL(href, baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    const google = ["google.com", "www.google.com", "maps.google.com"].includes(
      url.hostname,
    );
    if (
      google &&
      /^\/maps\/d\/(?:u\/\d+\/)?(?:embed|viewer|edit)\/?$/.test(url.pathname)
    ) {
      const mid = url.searchParams.get("mid");
      if (mid && /^[\w-]+$/.test(mid)) {
        return {
          url: `https://www.google.com/maps/d/viewer?mid=${mid}`,
          mid,
          context: [],
        };
      }
    }
    if (
      (google &&
        (url.hostname === "maps.google.com" ||
          /^\/maps(?:\/|$)/.test(url.pathname))) ||
      url.hostname === "maps.app.goo.gl" ||
      (url.hostname === "goo.gl" && url.pathname.startsWith("/maps"))
    ) {
      url.hash = "";
      return { url: url.href, context: [] };
    }
  } catch {
    // Invalid references do not establish map evidence.
  }
  return null;
}

export function mergeMapReferences(
  ...groups: MapReference[][]
): MapReference[] {
  const merged = new Map<string, MapReference>();
  for (const ref of groups.flat()) {
    const key = ref.mid ?? ref.url;
    const prior = merged.get(key);
    if (prior) {
      prior.context = [...new Set([...prior.context, ...ref.context])];
    } else {
      merged.set(key, { ...ref, context: [...ref.context] });
    }
  }
  return [...merged.values()];
}

function localContext(node: ReturnType<CheerioAPI>): string[] {
  const block = node.closest("section, article, div, p, li");
  return [
    node.attr("title"),
    node.attr("aria-label"),
    node.is("a") ? node.text() : "",
    block.find("h1, h2, h3, h4, h5, h6").first().text() ||
      node.prevAll("h1, h2, h3, h4, h5, h6").first().text() ||
      block.prevAll("h1, h2, h3, h4, h5, h6").first().text(),
    block
      .clone()
      .find("script, style, noscript, iframe")
      .remove()
      .end()
      .text()
      .slice(0, 500),
  ]
    .filter((value): value is string => !!value)
    .map(text)
    .filter(Boolean);
}

export function extractMapReferences(
  $: CheerioAPI,
  baseUrl: string,
): MapReference[] {
  const refs: MapReference[] = [];
  $("a, iframe, noscript").each((_index, element) => {
    const node = $(element);
    if (node.is("noscript")) {
      const nested = extractMapReferences(load(node.html() ?? ""), baseUrl);
      if (nested.length) {
        const outer = localContext(node);
        refs.push(
          ...nested.map((ref) => ({
            ...ref,
            context: [...ref.context, ...outer],
          })),
        );
      }
      return;
    }
    const detected = ["href", "src", "data-src", "data-lazy-src"]
      .map((attr) => mapReference(node.attr(attr) ?? "", baseUrl))
      .filter((ref): ref is MapReference => ref !== null);
    if (!detected.length) {
      return;
    }
    const context = [...new Set(localContext(node))];
    refs.push(...detected.map((ref) => ({ ...ref, context })));
  });
  return mergeMapReferences(refs);
}

// Escape source text so map labels cannot create Markdown structure.
export function mapText(value: string): string {
  return text(load(value, {}, false).text()).replace(/[\\`*_[\]<>#]/g, "\\$&");
}

export function referenceMarkdown(ref: MapReference): string {
  return `## Map\n\nSource: ${ref.url}\n\n${ref.context.map(mapText).join(" · ")}`.trim();
}

export function coordinatePair(
  latitude: unknown,
  longitude: unknown,
): [number, number] | null {
  if (
    ![latitude, longitude].every(
      (value) =>
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== ""),
    )
  ) {
    return null;
  }
  const lat = Number(latitude),
    lng = Number(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? [lat, lng]
    : null;
}

import { randomUUID } from "node:crypto";
import { load, type CheerioAPI } from "cheerio";
import { htmlToMarkdown, type TransformPlugin } from "@mdream/js";
import { frontmatterPlugin } from "@mdream/js/plugins";
import {
  coordinatePair,
  extractMapReferences,
  type MapReference,
} from "./maps";

const REGION_ATTRIBUTE = "data-source-region";
const MIN_SCRIPTED_TEXT_CHARS = 200;

function markRegions($: CheerioAPI, finalUrl: string): void {
  // Only converter-assigned labels are used by the region plugin below.
  $(`[${REGION_ATTRIBUTE}]`).removeAttr(REGION_ATTRIBUTE);
  let main = $("main, [role='main']");
  if (!main.length) {
    const page = new URL(finalUrl);
    page.hash = "";
    for (const anchor of $("a[href]").toArray()) {
      const label = $(anchor).attr("aria-label") || $(anchor).text();
      if (
        !/(?:skip|jump)\s+to\s+(?:the\s+)?(?:main\s+)?content|zum\s+hauptinhalt/i.test(
          label,
        )
      ) {
        continue;
      }
      try {
        const targetUrl = new URL($(anchor).attr("href")!, finalUrl);
        const id = decodeURIComponent(targetUrl.hash.slice(1));
        targetUrl.hash = "";
        if (!id || targetUrl.href !== page.href) {
          continue;
        }
        const target = $("[id]")
          .filter((_index, node) => $(node).attr("id") === id)
          .first();
        if (!target.length || !target.is("div, main, section, article")) {
          continue;
        }
        main = target;
        break;
      } catch {
        // Invalid skip links do not establish a content region.
      }
    }
  }
  main.attr(REGION_ATTRIBUTE, "Main content");
  $("nav, [role='navigation']").attr(REGION_ATTRIBUTE, "Navigation");
  $("aside, [role='complementary']").attr(REGION_ATTRIBUTE, "Aside");
  for (const [selector, label] of [
    ["header, [role='banner']", "Page header"],
    ["footer, [role='contentinfo']", "Page footer"],
  ]) {
    $(selector).each((_index, node) => {
      // A section/article header is not the page header.
      if (
        !$(node).parents(
          `article, section, aside, nav, main, [role='main'], [${REGION_ATTRIBUTE}]`,
        ).length
      ) {
        $(node).attr(REGION_ATTRIBUTE, label);
      }
    });
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function regionPlugin(marker: string): TransformPlugin {
  return {
    onNodeEnter(node) {
      const label = node.attributes[REGION_ATTRIBUTE];
      if (label) {
        return `\n\n<!-- ${label} ${marker} -->\n\n`;
      }
    },
    onNodeExit(node) {
      const label = node.attributes[REGION_ATTRIBUTE];
      if (label) {
        return `\n\n<!-- /${label} ${marker} -->\n\n`;
      }
    },
  };
}

function removeEmptyRegions(markdown: string, marker: string): string {
  // Only generated comments carry this conversion's marker.
  const emptyPair = new RegExp(
    `<!-- (Navigation|Main content|Page header|Page footer|Aside) ${marker} -->\\s*<!-- /\\1 ${marker} -->`,
    "g",
  );
  // Repeat so an empty child cannot keep an empty parent region.
  let previous: string;
  do {
    previous = markdown;
    markdown = markdown.replace(emptyPair, "");
  } while (markdown !== previous);
  return markdown.replaceAll(` ${marker}`, "").trim();
}

function safeLink(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function structuredItems(
  value: unknown,
  items: string[],
  baseUrl: string,
  path = "",
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      structuredItems(item, items, baseUrl, path);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  const fields = [
    "@type",
    "name",
    "description",
    "startDate",
    "endDate",
    "doorTime",
    "eventStatus",
    "availability",
    "price",
    "priceCurrency",
    "url",
    "streetAddress",
    "addressLocality",
    "addressRegion",
    "addressCountry",
    "postalCode",
    "maximumAttendeeCapacity",
  ];
  const values = fields
    .filter(
      (field) =>
        typeof record[field] === "string" || typeof record[field] === "number",
    )
    .map((field) => {
      const value = clean(String(record[field]));
      return `${field}: ${field === "url" ? (safeLink(value, baseUrl) ?? value) : value}`;
    });
  const types = Array.isArray(record["@type"])
    ? record["@type"]
    : [record["@type"]];
  if (
    (types.includes("Place") || path.split(".").at(-1) === "location") &&
    record.geo &&
    typeof record.geo === "object"
  ) {
    const geo = record.geo as Record<string, unknown>;
    const pair = coordinatePair(geo.latitude, geo.longitude);
    if (pair) {
      values.push(`latitude: ${pair[0]}`, `longitude: ${pair[1]}`);
    }
  }
  const label = path ? `${path}: ` : "";
  if (values.length) {
    items.push(`- ${label}${values.join(" · ")}`);
  }
  for (const nested of [
    "@graph",
    "location",
    "address",
    "offers",
    "organizer",
    "performer",
    "subEvent",
  ]) {
    structuredItems(
      record[nested],
      items,
      baseUrl,
      path ? `${path}.${nested}` : nested,
    );
  }
}

export function extractSource(
  body: string,
  finalUrl: string,
  contentType: string,
): {
  markdown: string;
  maps: MapReference[];
  needsJavascript: boolean;
  nonNavigationTextLength: number;
} {
  if (
    contentType.includes("application/json") ||
    contentType.includes("application/ld+json")
  ) {
    const items: string[] = [];
    try {
      structuredItems(JSON.parse(body), items, finalUrl);
    } catch {
      items.push(body);
    }
    return {
      markdown: items.join("\n\n").trim(),
      maps: [],
      needsJavascript: false,
      nonNavigationTextLength: 0,
    };
  }
  if (contentType.includes("text/plain")) {
    return {
      markdown: body.replace(/\r\n?/g, "\n").trim(),
      maps: [],
      needsJavascript: false,
      nonNavigationTextLength: 0,
    };
  }

  const $ = load(body);
  const maps = extractMapReferences($, finalUrl);
  const hasApplicationScripts = $("script")
    .toArray()
    .some(
      (element) =>
        $(element).attr("type")?.toLowerCase() !== "application/ld+json",
    );
  const structured: string[] = [];
  $("script[type='application/ld+json']").each((_index, element) => {
    try {
      structuredItems(
        JSON.parse($(element).html() ?? ""),
        structured,
        finalUrl,
      );
    } catch {
      // Malformed structured data does not invalidate visible content.
    }
  });
  $(
    "script, style, noscript, svg, template, select, [hidden], [aria-hidden='true']",
  ).remove();
  $("time[datetime]").each((_index, element) => {
    const dateTime = clean($(element).attr("datetime") ?? "");
    const label = clean($(element).text());
    if (dateTime && !label.includes(dateTime)) {
      $(element).text(`${label || "Time"}: ${dateTime}`);
    }
  });
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }
    const labelNode = $(element).clone();
    labelNode
      .find("div, p, h1, h2, h3, h4, h5, h6, section, article, br")
      .each((_index, child) => {
        $(child).before(" ");
        $(child).after(" ");
      });
    const label =
      clean(labelNode.text()) ||
      clean($(element).find("img[alt]").first().attr("alt") ?? "");
    const url = safeLink(href, finalUrl);
    if (url) {
      $(element).attr("href", url);
    } else {
      $(element).removeAttr("href");
    }
    // Flatten block content to keep each link label on one line.
    if (
      label &&
      $(element).find("div, p, h1, h2, h3, h4, h5, h6, section, article, br")
        .length
    ) {
      $(element).text(label);
    }
  });
  // Measure before adding image alt text and fallback labels. They must not
  // change the sparse-page signal used to request rendering.
  const contentText = clean(
    $("body")
      .clone()
      .find(
        "header, nav, footer, [role='banner'], [role='navigation'], [role='contentinfo']",
      )
      .remove()
      .end()
      .text(),
  );
  $("img").each((_index, element) => {
    const alt = clean($(element).attr("alt") ?? "");
    $(element).replaceWith($("<span>").text(alt ? ` ${alt} ` : ""));
  });
  $("a").each((_index, element) => {
    if (clean($(element).text())) {
      return;
    }
    const label = [
      $(element).attr("aria-label"),
      $(element).attr("title"),
      $(element).attr("href"),
    ]
      .map((value) => clean(value ?? ""))
      .find(Boolean);
    if (label) {
      $(element).text(label);
    }
  });
  markRegions($, finalUrl);
  const regionMarker = randomUUID();
  const visible = removeEmptyRegions(
    htmlToMarkdown($.html(), {
      origin: finalUrl,
      // Keep adjacent calendar days and other button labels separate.
      tagOverrides: { button: { spacing: [1, 1] } },
      plugins: [frontmatterPlugin(), regionPlugin(regionMarker)],
    }),
    regionMarker,
  );
  const parts = [
    visible,
    structured.length ? `## Structured data\n\n${structured.join("\n\n")}` : "",
  ].filter(Boolean);
  return {
    markdown: parts.join("\n\n").trim(),
    maps,
    needsJavascript:
      hasApplicationScripts && contentText.length < MIN_SCRIPTED_TEXT_CHARS,
    nonNavigationTextLength: contentText.length,
  };
}

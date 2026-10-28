import { load, type CheerioAPI } from "cheerio";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";

const REGION_ATTRIBUTE = "data-source-region";
export const MIN_RENDERED_TEXT_CHARS = 200;

function markRegions($: CheerioAPI, finalUrl: string): void {
  // Only converter-assigned labels are used by the Turndown rule below.
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
      needsJavascript: false,
      nonNavigationTextLength: 0,
    };
  }
  if (contentType.includes("text/plain")) {
    return {
      markdown: body.replace(/\r\n?/g, "\n").trim(),
      needsJavascript: false,
      nonNavigationTextLength: 0,
    };
  }

  const $ = load(body);
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
    if (!label) {
      $(element).remove();
      return;
    }
    // Turndown can emit a multiline Markdown link when an anchor wraps block
    // elements. Flatten that label while preserving its place in page order.
    if (
      $(element).find("div, p, h1, h2, h3, h4, h5, h6, section, article, br")
        .length
    ) {
      $(element).text(label);
    }
  });
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
  const title = clean($("title").first().text());
  markRegions($, finalUrl);
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  turndown.addRule("imageAltWithoutMediaUrl", {
    filter: "img",
    replacement: (_content, node) => clean(node.getAttribute("alt") ?? ""),
  });
  turndown.use(tables);
  turndown.addRule("singleLineTableCell", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      const inline = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("; ")
        .replace(/[ \t]+/g, " ");
      const prefix = node.parentNode?.firstChild === node ? "| " : " ";
      return `${prefix}${inline} |`;
    },
  });
  turndown.addRule("structuralRegion", {
    filter: (node) => node.hasAttribute(REGION_ATTRIBUTE),
    replacement: (content, node) => {
      if (!content.trim()) {
        return "";
      }
      const label = node.getAttribute(REGION_ATTRIBUTE);
      return `\n\n<!-- ${label} -->\n\n${content.trim()}\n\n<!-- /${label} -->\n\n`;
    },
  });
  const visible = turndown.turndown($("body").html() ?? "").trim();
  const parts = [
    title ? `# ${title}` : "",
    visible,
    structured.length ? `## Structured data\n\n${structured.join("\n\n")}` : "",
  ].filter(Boolean);
  return {
    markdown: parts.join("\n\n").trim(),
    needsJavascript:
      hasApplicationScripts && contentText.length < MIN_RENDERED_TEXT_CHARS,
    nonNavigationTextLength: contentText.length,
  };
}

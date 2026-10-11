import { load, type CheerioAPI } from "cheerio";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";

const MAX_MARKDOWN_CHARS = 20_000;
const MAX_LINKS = 120;
const REGION_ATTRIBUTE = "data-source-region";

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

function appendLink(links: string[], url: string): void {
  if (links.length < MAX_LINKS && !links.includes(url)) {
    links.push(url);
  }
}

function structuredItems(
  value: unknown,
  items: string[],
  links: string[],
  baseUrl: string,
  path = "",
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      structuredItems(item, items, links, baseUrl, path);
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
    .map((field) => `${field}: ${clean(String(record[field]))}`);
  const label = path ? `${path}: ` : "";
  if (values.length) {
    items.push(`- ${label}${values.join(" · ")}`);
  }
  if (typeof record.url === "string") {
    const url = safeLink(record.url, baseUrl);
    if (url) {
      appendLink(links, url);
    }
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
      links,
      baseUrl,
      path ? `${path}.${nested}` : nested,
    );
  }
}

function finalWordBoundary(text: string): number {
  let index = text.length - 1;
  while (index >= 0 && !/\s/.test(text[index])) {
    index -= 1;
  }
  if (index < 0) {
    return -1;
  }
  while (index >= 0 && /\s/.test(text[index])) {
    index -= 1;
  }
  return index + 1;
}

function boundMarkdown(markdown: string): {
  markdown: string;
  truncated: boolean;
} {
  const content = markdown.trim();
  if (content.length <= MAX_MARKDOWN_CHARS) {
    return { markdown: content, truncated: false };
  }

  const prefix = content.slice(0, MAX_MARKDOWN_CHARS);
  // Keep the final paragraph, line, or word whole where possible. A page
  // without whitespace still retains a bounded prefix instead of vanishing.
  const paragraphEnd = prefix.lastIndexOf("\n\n");
  const lineEnd = prefix.lastIndexOf("\n");
  let end = finalWordBoundary(prefix);
  if (paragraphEnd > MAX_MARKDOWN_CHARS - 2_000) {
    end = paragraphEnd;
  } else if (lineEnd > MAX_MARKDOWN_CHARS - 2_000) {
    end = lineEnd;
  }
  if (end <= 0) {
    end = MAX_MARKDOWN_CHARS;
  }
  // A Markdown link is atomic: do not emit a dangling label or destination.
  const openLabel = prefix.lastIndexOf("[") > prefix.lastIndexOf("]");
  const openDestination = prefix.lastIndexOf("](") > prefix.lastIndexOf(")");
  if (openLabel || openDestination) {
    const linkStart = prefix.lastIndexOf("[");
    if (linkStart > 0 && linkStart < end) {
      end = linkStart;
    }
  }
  return { markdown: prefix.slice(0, end).trimEnd(), truncated: true };
}

export function extractSource(
  body: string,
  finalUrl: string,
  contentType: string,
): {
  markdown: string;
  links: string[];
  needsJavascript: boolean;
  truncated: boolean;
} {
  const links: string[] = [];
  if (
    contentType.includes("application/json") ||
    contentType.includes("application/ld+json")
  ) {
    const items: string[] = [];
    try {
      structuredItems(JSON.parse(body), items, links, finalUrl);
    } catch {
      items.push(body);
    }
    return {
      ...boundMarkdown(items.join("\n\n")),
      links,
      needsJavascript: false,
    };
  }
  if (contentType.includes("text/plain")) {
    return {
      ...boundMarkdown(body.replace(/\r\n?/g, "\n")),
      links,
      needsJavascript: false,
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
        links,
        finalUrl,
      );
    } catch {
      // Malformed structured data does not invalidate visible content.
    }
  });
  $(
    "script, style, noscript, svg, template, [hidden], [aria-hidden='true']",
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
      appendLink(links, url);
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
    $("body").clone().find("header, nav, footer").remove().end().text(),
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
  turndown.addRule("structuralRegion", {
    filter: (node) => node.hasAttribute(REGION_ATTRIBUTE),
    replacement: (content, node) => {
      if (!content.trim()) {
        return "";
      }
      const label = node.getAttribute(REGION_ATTRIBUTE);
      return `\n\n[${label}]\n\n${content.trim()}\n\n[/${label}]\n\n`;
    },
  });
  const visible = turndown.turndown($("body").html() ?? "").trim();
  const parts = [
    title ? `# ${title}` : "",
    visible,
    structured.length ? `## Structured data\n\n${structured.join("\n\n")}` : "",
  ].filter(Boolean);
  return {
    ...boundMarkdown(parts.join("\n\n")),
    links,
    needsJavascript: hasApplicationScripts && contentText.length < 200,
  };
}

import { fromMarkdown } from "mdast-util-from-markdown";
import type { SourceLink } from "../sources/contracts";

type Node = {
  type: string;
  value?: string;
  url?: string;
  identifier?: string;
  children?: Node[];
};

const textOf = (node: Node): string =>
  node.value ?? node.children?.map(textOf).join("") ?? "";
const compact = (text: string) => text.replace(/\s+/g, " ").trim();

// Fixtures store page content once. Rebuild only the reader's internal link
// index; the model still receives the original Markdown, not this index.
export function sourceLinks(markdown: string, finalUrl: string): SourceLink[] {
  const root = fromMarkdown(markdown);
  const definitions = new Map<string, string>();
  const collect = (node: Node) => {
    if (node.type === "definition" && node.identifier && node.url)
      definitions.set(node.identifier, node.url);
    node.children?.forEach(collect);
  };
  collect(root);
  const links: SourceLink[] = [];
  let heading = "";
  const visit = (node: Node, parent?: Node) => {
    if (node.type === "heading") heading = textOf(node);
    const href =
      node.type === "link"
        ? node.url
        : node.type === "linkReference"
          ? definitions.get(node.identifier ?? "")
          : undefined;
    if (href && links.length < 120) {
      try {
        const url = new URL(href, finalUrl);
        const text = compact(textOf(node)).slice(0, 300);
        if (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !links.some((link) => link.url === url.href && link.text === text)
        ) {
          const context = compact(
            `${heading} ${parent ? textOf(parent) : text}`,
          ).slice(0, 500);
          links.push({ url: url.href, text, ...(context ? { context } : {}) });
        }
      } catch {
        // Ignore malformed links as the live source reader does.
      }
    }
    node.children?.forEach((child) => visit(child, node));
  };
  visit(root);
  return links;
}

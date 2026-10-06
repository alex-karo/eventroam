import { fromMarkdown } from "mdast-util-from-markdown";

type Node = {
  type: string;
  url?: string;
  identifier?: string;
  children?: Node[];
};

// Fixtures store page content once. Rebuild only the reader's internal link
// index; the model still receives the original Markdown, not this index.
export function sourceLinks(markdown: string, finalUrl: string): string[] {
  const root = fromMarkdown(markdown);
  const definitions = new Map<string, string>();
  const collect = (node: Node) => {
    if (node.type === "definition" && node.identifier && node.url)
      definitions.set(node.identifier, node.url);
    node.children?.forEach(collect);
  };
  collect(root);
  const links: string[] = [];
  const visit = (node: Node) => {
    const href =
      node.type === "link"
        ? node.url
        : node.type === "linkReference"
          ? definitions.get(node.identifier ?? "")
          : undefined;
    if (href && links.length < 120) {
      try {
        const url = new URL(href, finalUrl);
        if (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !links.includes(url.href)
        ) {
          links.push(url.href);
        }
      } catch {
        // Ignore malformed links as the live source reader does.
      }
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return links;
}

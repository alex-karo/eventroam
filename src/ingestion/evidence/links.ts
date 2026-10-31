import { fromMarkdown } from "mdast-util-from-markdown";

/** Page links are navigation leads. They are not evidence of destination content. */
export function pageLinks(markdown: string, baseUrl: string) {
  const tree = fromMarkdown(markdown);
  const definitions = new Map<string, string>();
  function walk(
    node: (typeof tree)["children"][number] | typeof tree,
    visit: (node: (typeof tree)["children"][number] | typeof tree) => void,
  ) {
    visit(node);
    if ("children" in node) {
      for (const child of node.children) {
        walk(child, visit);
      }
    }
  }
  walk(tree, (node) => {
    if (node.type === "definition") {
      definitions.set(node.identifier, node.url);
    }
  });
  const leads: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  walk(tree, (node) => {
    if (node.type !== "link" && node.type !== "linkReference") {
      return;
    }
    const destination =
      node.type === "link" ? node.url : definitions.get(node.identifier);
    if (!destination) {
      return;
    }
    try {
      const url = new URL(destination, baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || seen.has(url.href)) {
        return;
      }
      let label = "";
      walk(node, (child) => {
        if (child.type === "text" || child.type === "inlineCode") {
          label += child.value;
        }
      });
      seen.add(url.href);
      leads.push({ url: url.href, label: label.slice(0, 200) });
    } catch {
      // An invalid destination cannot be inspected.
    }
  });
  return leads;
}

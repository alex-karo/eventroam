import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const statuses = new Set(["draft", "stable", "deprecated"]);

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  });
}

function bodyAndMetadata(content, name, errors) {
  if (!content.startsWith("---\n")) {
    errors.push(`${name}: missing YAML frontmatter`);
    return { body: content, metadata: null };
  }
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) {
    errors.push(`${name}: unclosed YAML frontmatter`);
    return { body: content, metadata: null };
  }
  const document = parseDocument(content.slice(4, end));
  for (const error of document.errors) errors.push(`${name}: ${error.message}`);
  let metadata = null;
  if (!document.errors.length) {
    metadata = document.toJS();
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
      errors.push(`${name}: frontmatter must be a YAML mapping`);
      metadata = null;
    }
  }
  return { body: content.slice(end + 5), metadata };
}

function links(body) {
  const found = [];
  const lines = [];
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      const kind = marker[1][0];
      if (!fence) fence = { kind, length: marker[1].length };
      else if (kind === fence.kind && marker[1].length >= fence.length)
        fence = null;
      continue;
    }
    if (fence) continue;
    lines.push(line);
  }
  const references = new Map();
  const label = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const line of lines) {
    const definition = line.match(/^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/);
    if (definition)
      references.set(label(definition[1]), definition[2].replace(/^<|>$/g, ""));
  }
  for (const line of lines) {
    const pattern = /(?<!!)\[[^\]]+\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g;
    for (const match of line.matchAll(pattern)) {
      found.push(match[1].replace(/^<|>$/g, ""));
    }
    const referencePattern = /(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g;
    for (const match of line.matchAll(referencePattern)) {
      const href = references.get(label(match[2] || match[1]));
      if (href) found.push(href);
    }
    const shortcutPattern = /(?<![!\]])\[([^\]]+)\](?![\[(:])/g;
    for (const match of line.matchAll(shortcutPattern)) {
      const href = references.get(label(match[1]));
      if (href) found.push(href);
    }
  }
  return found;
}

function localTarget(root, from, href) {
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) return null;
  const pathname = href.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { error: `invalid URL encoding in ${href}` };
  }
  const resolved = decoded.startsWith("/")
    ? path.resolve(root, `.${decoded}`)
    : path.resolve(path.dirname(from), decoded);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return { error: `link leaves repository: ${href}` };
  }
  return { path: resolved };
}

export function checkDocs(root = defaultRoot) {
  const errors = [];
  const markdown = ["docs", "specs"].flatMap((directory) =>
    markdownFiles(path.join(root, directory)),
  );
  const concepts = markdown.filter(
    (file) => !["index.md", "log.md"].includes(path.basename(file)),
  );
  const index = path.join(root, "docs/index.md");
  if (!existsSync(index))
    errors.push("docs/index.md: missing documentation index");
  const files = [
    ...markdown,
    ...[path.join(root, "AGENTS.md")].filter(existsSync),
  ];
  const indexed = new Set();

  for (const file of files) {
    const name = path.relative(root, file);
    const content = readFileSync(file, "utf8");
    const isConcept = concepts.includes(file);
    const { body, metadata } = isConcept
      ? bodyAndMetadata(content, name, errors)
      : { body: content, metadata: null };
    if (isConcept && metadata) {
      for (const field of ["type", "title", "description"]) {
        if (typeof metadata[field] !== "string" || !metadata[field].trim()) {
          errors.push(`${name}: ${field} must be a non-empty string`);
        }
      }
      if (!statuses.has(metadata.status)) {
        errors.push(`${name}: status must be draft, stable, or deprecated`);
      }
      const heading = body.match(/^# (.+)$/m)?.[1];
      if (heading && metadata.title !== heading) {
        errors.push(`${name}: title must match the first H1 heading`);
      }
      if (
        metadata.tags !== undefined &&
        (!Array.isArray(metadata.tags) ||
          metadata.tags.some((tag) => typeof tag !== "string" || !tag.trim()))
      ) {
        errors.push(`${name}: tags must be a list of non-empty strings`);
      }
    }
    for (const href of links(body)) {
      const target = localTarget(root, file, href);
      if (!target) continue;
      if (target.error) {
        errors.push(`${name}: ${target.error}`);
        continue;
      }
      if (!existsSync(target.path)) {
        errors.push(`${name}: broken local link: ${href}`);
        continue;
      }
      if (file === index && concepts.includes(target.path))
        indexed.add(target.path);
    }
  }
  for (const file of concepts) {
    if (!indexed.has(file))
      errors.push(`${path.relative(root, file)}: missing from docs/index.md`);
  }
  return { errors, count: concepts.length };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { errors, count } = checkDocs();
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Checked ${count} documents, index coverage, and local links.`);
  }
}

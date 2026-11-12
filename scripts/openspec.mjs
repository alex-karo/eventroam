import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parse } from "yaml";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../bin/openspec.js", import.meta.resolve("@fission-ai/openspec")),
);
const artifacts = ["proposal.md", "design.md", "tasks.md"];

export function openspec(root, args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, OPENSPEC_TELEMETRY: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function textOf(node) {
  if (["code", "html", "definition", "image"].includes(node.type)) {
    return "";
  }
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

function hasScenarioStatement(node) {
  if (node.type === "paragraph") {
    const first = node.children[0];
    if (
      first?.type === "strong" &&
      ["GIVEN", "WHEN", "THEN"].includes(textOf(first))
    ) {
      return true;
    }
  }
  return node.children?.some(hasScenarioStatement) ?? false;
}

export function checkProposal(content, name = "proposal.md") {
  const errors = [];
  const sections = new Map(
    ["Requirements", "Acceptance criteria"].map((title) => [
      title,
      { count: 0, items: 0 },
    ]),
  );
  let section;
  const fail = (node, message) =>
    errors.push(`${name}:${node.position.start.line}: ${message}`);
  for (const node of fromMarkdown(content).children) {
    if (node.type === "heading" && node.depth <= 2) {
      section =
        node.depth === 2 ? sections.get(textOf(node).trim()) : undefined;
      if (section) {
        section.count += 1;
      }
      continue;
    }
    if (!section) {
      continue;
    }
    if (hasScenarioStatement(node)) {
      fail(node, "use short statements without GIVEN/WHEN/THEN scenarios");
    }
    if (node.type === "list") {
      for (const item of node.children) {
        if (textOf(item).trim()) {
          section.items += 1;
        } else {
          fail(item, "list item needs an observable requirement or result");
        }
      }
    }
  }
  for (const [title, { count, items }] of sections) {
    if (count !== 1 || items === 0) {
      errors.push(`${name}: use one ## ${title} section with a non-empty list`);
    }
  }
  return errors;
}

function activeChanges(root) {
  return readdirSync(path.join(root, "openspec/changes"), {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "archive" &&
        !entry.name.startsWith("."),
    )
    .map((entry) => entry.name)
    .sort();
}

export function checkChange(root, name, { draft = false } = {}) {
  if (!activeChanges(root).includes(name)) {
    return [`Unknown active change: ${name}`];
  }
  const directory = path.join(root, "openspec/changes", name);
  const errors = [];
  const metadata = path.join(directory, ".openspec.yaml");
  if (
    !existsSync(metadata) ||
    parse(readFileSync(metadata, "utf8"))?.schema !== "review-driven"
  ) {
    errors.push(`${name}: .openspec.yaml must select review-driven`);
  }
  if (existsSync(path.join(directory, "specs"))) {
    errors.push(`${name}: move delta requirements into proposal.md`);
  }
  if (existsSync(path.join(directory, "prd.md"))) {
    errors.push(
      `${name}: move PRD requirements into proposal.md and remove prd.md`,
    );
  }
  const missing = [];
  for (const file of artifacts) {
    const target = path.join(directory, file);
    if (!existsSync(target)) {
      missing.push(file);
      if (!draft) {
        errors.push(`${name}/${file}: missing required artifact`);
      }
      continue;
    }
    if (missing.length) {
      errors.push(
        `${name}/${file}: missing predecessor: ${missing.join(", ")}`,
      );
    }
    const content = readFileSync(target, "utf8");
    const body = fromMarkdown(content).children.filter(
      (node) => node.type !== "heading",
    );
    if (!body.map(textOf).join("").trim()) {
      errors.push(`${name}/${file}: empty artifact`);
    }
    if (file === "proposal.md") {
      errors.push(...checkProposal(content, `${name}/${file}`));
    }
  }
  return errors;
}

export function validate(root = defaultRoot, { name, draft = false } = {}) {
  openspec(root, ["schema", "validate", "review-driven"]);
  const names = name ? [name] : activeChanges(root);
  const errors = names.flatMap((change) =>
    checkChange(root, change, { draft }),
  );
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  return names.length;
}

export function archive(root, name) {
  validate(root, { name });
  const apply = JSON.parse(
    openspec(root, ["instructions", "apply", "--change", name, "--json"]),
  );
  if (apply.schemaName !== "review-driven" || apply.state !== "all_done") {
    throw new Error(
      `${name}: archive requires completed tracked tasks. ${apply.instruction}`,
    );
  }
  return openspec(root, [
    "archive",
    name,
    "--skip-specs",
    "--no-validate",
    "--yes",
  ]);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, ...args] = process.argv
      .slice(2)
      .filter((arg) => arg !== "--");
    const draft = args.includes("--draft");
    const names = args.filter((arg) => arg !== "--draft");
    if (
      names.some((arg) => arg.startsWith("-")) ||
      names.length > 1 ||
      !["validate", "archive"].includes(command) ||
      (command === "archive" && (draft || names.length !== 1))
    ) {
      throw new Error(
        "Use validate [change-name] [--draft] or archive <change-name>.",
      );
    }
    if (command === "archive") {
      console.log(archive(defaultRoot, names[0]).trim());
    } else {
      console.log(
        `Checked ${validate(defaultRoot, { name: names[0], draft })} active change(s)${draft ? " (draft mode)" : ""}.`,
      );
    }
  } catch (error) {
    console.error(error.stderr?.toString().trim() || error.message);
    process.exitCode = 1;
  }
}

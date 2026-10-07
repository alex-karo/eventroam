import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkDocs } from "./check-docs.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "eventroam-docs-"));
  mkdirSync(path.join(root, "docs"));
  mkdirSync(path.join(root, "specs"));
  const write = (name, content) =>
    writeFileSync(path.join(root, name), content, "utf8");
  write(
    "specs/topic.md",
    "---\ntype: Specification\ntitle: Topic\ndescription: A useful topic.\nstatus: stable\n---\n\n# Topic\n\nSee [index](../docs/index.md).\n",
  );
  write("docs/index.md", "# Docs\n\n- [Topic](../specs/topic.md)\n");
  write("AGENTS.md", "# Agent\n\nSee [docs](docs/index.md).\n");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, write };
}

test("accepts indexed documents and ignores external links", (t) => {
  const { root, write } = fixture(t);
  write(
    "AGENTS.md",
    "# Agent\n\nSee [external](https://example.org/missing).\n",
  );
  assert.deepEqual(checkDocs(root), { errors: [], count: 1 });
});

test("rejects missing or invalid frontmatter", (t) => {
  const { root, write } = fixture(t);
  write("specs/topic.md", "# Topic\n");
  assert.match(checkDocs(root).errors.join("\n"), /missing YAML frontmatter/);
  write(
    "specs/topic.md",
    "---\ntype: Specification\ntitle: Topic\ndescription: A useful topic.\nstatus: approved\n---\n\n# Topic\n",
  );
  assert.match(
    checkDocs(root).errors.join("\n"),
    /status must be draft, stable, or deprecated/,
  );
  write(
    "specs/topic.md",
    "---\ntitle: Topic\ndescription: A useful topic.\nstatus: stable\n---\n\n# Topic\n",
  );
  assert.match(
    checkDocs(root).errors.join("\n"),
    /type must be a non-empty string/,
  );
  write(
    "specs/topic.md",
    "---\ntype: Specification\ntitle: Wrong title\ndescription: A useful topic.\nstatus: stable\n---\n\n# Topic\n",
  );
  assert.match(
    checkDocs(root).errors.join("\n"),
    /title must match the first H1/,
  );
});

test("rejects documents missing from the index", (t) => {
  const { root, write } = fixture(t);
  write("docs/index.md", "# Docs\n");
  assert.match(
    checkDocs(root).errors.join("\n"),
    /missing from docs\/index\.md/,
  );
});

test("rejects broken local links", (t) => {
  const { root, write } = fixture(t);
  write("AGENTS.md", "# Agent\n\nSee [missing](docs/missing.md).\n");
  assert.match(checkDocs(root).errors.join("\n"), /broken local link/);
});

test("checks links in nested index files without requiring metadata", (t) => {
  const { root, write } = fixture(t);
  mkdirSync(path.join(root, "docs", "nested"));
  write("docs/nested/index.md", "# Nested index\n\n[Missing](missing.md)\n");
  assert.match(checkDocs(root).errors.join("\n"), /broken local link/);
});

test("checks reference links and counts them toward index coverage", (t) => {
  const { root, write } = fixture(t);
  write(
    "docs/index.md",
    "# Docs\n\n[Topic][topic]\n\n[topic]: ../specs/topic.md\n",
  );
  assert.deepEqual(checkDocs(root), { errors: [], count: 1 });
  write(
    "AGENTS.md",
    "# Agent\n\n[Missing][target]\n\n[target]: docs/missing.md\n",
  );
  assert.match(checkDocs(root).errors.join("\n"), /broken local link/);
});

test("checks shortcut references and counts them toward index coverage", (t) => {
  const { root, write } = fixture(t);
  write("docs/index.md", "# Docs\n\n[Topic]\n\n[Topic]: ../specs/topic.md\n");
  assert.deepEqual(checkDocs(root), { errors: [], count: 1 });
  write(
    "AGENTS.md",
    "# Agent\n\nSee [Missing].\n\n[Missing]: docs/missing.md\n",
  );
  assert.match(checkDocs(root).errors.join("\n"), /broken local link/);
});

test("ignores links in code and image destinations", (t) => {
  const { root, write } = fixture(t);
  write(
    "AGENTS.md",
    [
      "# Agent",
      "",
      "`[Inline](docs/missing-inline.md)`",
      "",
      "```md",
      "[Fenced](docs/missing-fenced.md)",
      "```",
      "",
      "    [Indented](docs/missing-indented.md)",
      "",
      "![Image](docs/missing-image.png)",
      "",
    ].join("\n"),
  );
  assert.deepEqual(checkDocs(root), { errors: [], count: 1 });
});

test("checks inline destinations with balanced parentheses", (t) => {
  const { root, write } = fixture(t);
  write("AGENTS.md", "# Agent\n\n[Missing](docs/missing-(draft).md)\n");
  assert.deepEqual(checkDocs(root).errors, [
    "AGENTS.md: broken local link: docs/missing-(draft).md",
  ]);
});

test("resolves references from the first definition outside code", (t) => {
  const { root, write } = fixture(t);
  write(
    "docs/index.md",
    [
      "# Docs",
      "",
      "[Topic][TOPIC] and [Topic][] and [Topic].",
      "",
      "```md",
      "[topic]: ../specs/missing-fenced.md",
      "```",
      "",
      "    [topic]: ../specs/missing-indented.md",
      "",
      "[topic]: ../specs/topic.md",
      "[TOPIC]: ../specs/missing-duplicate.md",
      "",
    ].join("\n"),
  );
  assert.deepEqual(checkDocs(root), { errors: [], count: 1 });
});

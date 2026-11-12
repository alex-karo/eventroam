import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  archive,
  checkChange,
  checkProposal,
  openspec,
  validate,
} from "./openspec.mjs";

const proposal = `# Proposal

## Why

Reject invalid changes before archive.

## Requirements

- Validate the change before archive.

## Acceptance criteria

- Invalid changes return an error.
`;

test("proposal checks separate requirement and acceptance lists without scenarios", () => {
  assert.deepEqual(checkProposal(proposal), []);
  const invalid = [
    [proposal.replace("## Requirements", "## Scope"), /## Requirements/],
    [
      proposal.replace("## Acceptance criteria", "### Acceptance criteria"),
      /## Acceptance criteria/,
    ],
    [
      proposal.replace(
        "Validate the change before archive.",
        "<!-- missing -->",
      ),
      /list item needs/,
    ],
    [
      proposal.replace("Invalid changes return an error.", "<!-- missing -->"),
      /list item needs/,
    ],
    [
      proposal + "\n## Requirements\n\n- Another rule.\n",
      /one ## Requirements/,
    ],
    [
      proposal + "\n## Acceptance criteria\n\n- Another result.\n",
      /one ## Acceptance criteria/,
    ],
    [
      proposal.replace(
        "Invalid changes return an error.",
        "**WHEN** input is invalid\n- **THEN** validation fails",
      ),
      /without GIVEN\/WHEN\/THEN/,
    ],
    ["```md\n" + proposal + "```", /## Requirements/],
    ["<!--\n" + proposal + "-->", /## Requirements/],
    [
      proposal.replace(
        "- Invalid changes return an error.",
        "```md\n- Example\n```",
      ),
      /## Acceptance criteria/,
    ],
  ];
  for (const [input, message] of invalid) {
    assert.match(checkProposal(input).join("\n"), message);
  }
  assert.deepEqual(
    checkProposal(proposal + "\n```md\n## Requirements\n- Example\n```\n"),
    [],
  );
  assert.deepEqual(
    checkProposal(
      proposal.replace(
        "Validate the change before archive.",
        "Report an error when the change is invalid.",
      ),
    ),
    [],
  );
});

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "eventroam-proposal-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "openspec/changes/archive"), { recursive: true });
  cpSync(
    new URL("../openspec/schemas", import.meta.url),
    path.join(root, "openspec/schemas"),
    { recursive: true },
  );
  writeFileSync(
    path.join(root, "openspec/config.yaml"),
    "schema: review-driven\n",
  );
  openspec(root, ["new", "change", "test-change"]);
  const directory = path.join(root, "openspec/changes/test-change");
  return {
    root,
    directory,
    write: (file, content) =>
      writeFileSync(path.join(directory, file), content),
  };
}

test("draft validation permits only a complete planning prefix", (t) => {
  const { root, directory, write } = fixture(t);
  assert.equal(validate(root, { draft: true }), 1);
  assert.throws(() => validate(root), /missing required artifact/);
  write("design.md", "# Design\n\nUse native archive.\n");
  assert.match(
    checkChange(root, "test-change", { draft: true }).join("\n"),
    /missing predecessor: proposal.md/,
  );
  write("proposal.md", proposal);
  assert.deepEqual(checkChange(root, "test-change", { draft: true }), []);
  write("prd.md", "Old requirements.\n");
  assert.match(
    checkChange(root, "test-change", { draft: true }).join("\n"),
    /remove prd.md/,
  );
  rmSync(path.join(directory, "prd.md"));
  write("proposal.md", "# Proposal\n<!-- only a comment -->\n");
  assert.match(
    checkChange(root, "test-change", { draft: true }).join("\n"),
    /empty artifact/,
  );
  assert.match(
    checkChange(root, "../archive").join("\n"),
    /Unknown active change/,
  );
});

function markdownFiles(directory) {
  return readdirSync(directory, { recursive: true }).filter((name) =>
    name.endsWith(".md"),
  );
}

test("native workflow reads three artifacts and archives completed valid changes", (t) => {
  const { root, directory, write } = fixture(t);
  const state = () =>
    JSON.parse(openspec(root, ["status", "--change", "test-change", "--json"]));
  assert.deepEqual(
    state().artifacts.map(({ id, status }) => [id, status]),
    [
      ["proposal", "ready"],
      ["design", "blocked"],
      ["tasks", "blocked"],
    ],
  );
  const documents = [
    ["proposal", proposal],
    ["design", "# Design\n\nUse native archive.\n"],
    ["tasks", "# Tasks\n\n- [ ] 1.1 Check the result with the smoke test\n"],
  ];
  for (const [index, [id, content]] of documents.entries()) {
    const instruction = JSON.parse(
      openspec(root, ["instructions", id, "--change", "test-change", "--json"]),
    );
    assert.deepEqual(
      state().artifacts.map((artifact) => artifact.status),
      documents.map((_, step) =>
        step < index ? "done" : step === index ? "ready" : "blocked",
      ),
    );
    assert.equal(instruction.artifactId, id);
    assert.ok(instruction.template);
    assert.ok(instruction.dependencies.every((dependency) => dependency.done));
    write(`${id}.md`, content);
  }
  assert.equal(validate(root), 1);
  assert.equal(state().isPlanningComplete, true);
  const apply = JSON.parse(
    openspec(root, [
      "instructions",
      "apply",
      "--change",
      "test-change",
      "--json",
    ]),
  );
  assert.deepEqual(Object.keys(apply.contextFiles), [
    "proposal",
    "design",
    "tasks",
  ]);
  assert.throws(() => archive(root, "test-change"), /completed tracked tasks/);
  write("tasks.md", "# Tasks\n\nNo tasks yet.\n");
  assert.throws(() => archive(root, "test-change"), /completed tracked tasks/);
  write(
    "tasks.md",
    "# Tasks\n\n- [x] 1.1 Check the result with the smoke test\n",
  );
  write(
    "proposal.md",
    proposal.replace("Invalid changes return an error.", "<!-- missing -->"),
  );
  assert.throws(() => archive(root, "test-change"), /list item needs/);
  assert.ok(existsSync(directory));
  write("proposal.md", proposal);
  // Native archive keeps a pre-dated name and rejects a collision.
  const dated = "2026-11-01-test-change";
  const datedDirectory = path.join(root, "openspec/changes", dated);
  cpSync(directory, datedDirectory, { recursive: true });
  mkdirSync(path.join(root, "openspec/changes/archive", dated));
  assert.throws(() => archive(root, dated));
  assert.equal(
    readFileSync(path.join(datedDirectory, "proposal.md"), "utf8"),
    proposal,
  );
  const output = archive(root, "test-change");
  assert.match(output, /archived/);
  assert.equal(existsSync(directory), false);
  const archived = readdirSync(
    path.join(root, "openspec/changes/archive"),
  ).find((name) => name.endsWith("-test-change") && name !== dated);
  assert.ok(archived);
  for (const file of [
    "proposal.md",
    "design.md",
    "tasks.md",
    ".openspec.yaml",
  ]) {
    assert.ok(
      existsSync(path.join(root, "openspec/changes/archive", archived, file)),
    );
  }
  assert.equal(
    readFileSync(
      path.join(root, "openspec/changes/archive", archived, "proposal.md"),
      "utf8",
    ),
    proposal,
  );
  assert.equal(
    existsSync(path.join(root, "openspec/changes/archive", archived, "prd.md")),
    false,
  );
  assert.deepEqual(markdownFiles(path.join(root, "openspec/specs")), []);
});

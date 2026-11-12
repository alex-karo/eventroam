# Design

## TL;DR

Keep the local `review-driven` schema and native OpenSpec creation, instructions, status, and task tracking. Use `proposal → design → tasks`. A small project script validates the three documents and archives completed changes through native OpenSpec without spec synchronization.

Code, tests, and current guides describe the system. Each proposal holds short added or changed requirements and a separate Acceptance criteria list. Main specs, archived specs, and separate PRDs are deleted. Proposals keep observable results and material checks; design and tasks hold implementation details.

## Key decisions

### Validate the project format

The upstream change validator expects delta specs. Use `scripts/openspec.mjs` for project validation and archive. Do not patch the dependency. Validate the local schema with the native CLI, then check active changes against the three known files. Full mode requires all three. CI draft mode allows any complete prefix, including a new empty scaffold. Existing documents contain text; proposals have non-empty Requirements and Acceptance criteria lists.

Use the installed Markdown parser to read the two proposal sections and their lists. Code examples and HTML comments do not count. Use plain statements without scenario blocks or required IDs. Content review and implementation checks stay with the review and verify skills.

### Reuse native archive and task tracking

After full validation, require native apply instructions to return `all_done`. This also rejects empty task files and unavailable tracking evidence. Then call native archive with `--skip-specs --no-validate --yes`. These flags bypass incompatible upstream delta checks only after project checks succeed. Native archive owns date naming, destination collision checks, and the move.

Native creation adds `skip_specs: true` for this schema and can create an empty specs directory. The marker means no upstream deltas; it does not waive proposal checks or mean the change has no behavior impact. The project stores no main spec files.

### Keep history without rebuilding a spec collection

Summarize active added or changed results for users, operators, or external consumers in proposal bullets. Group related acceptance checks in their own section, retaining material limits and failure cases. Move implementation choices to design and tasks. Remove the former spec inventory instead of renaming it. Remove the separate requirement files and update their links and the one older schema selection.

Delete main and archived specs, including `docs/archive/legacy-specs`. Keep other historical artifacts without new planning documents. Validation covers active changes; archive checks the input before moving it. It does not scan or reinterpret historical changes.

Update current guidance and links. Keep important storage and privacy rules in the existing owning guides and instructions. Remove the obsolete sync skill. Do not create a new permanent behavior inventory.

## Risks and validation

- Lost active scope: compare proposal requirements and acceptance criteria with the original requirements, cases, and design.
- Invalid proposals passing checks: use negative tests for missing, empty, or duplicate sections, scenario blocks, and examples that resemble requirements.
- Archive bypassing unfinished work: use native task evidence and test missing, empty, and unfinished tasks.
- Native integration changes: smoke-test creation, graph order, instructions, validation, archive collision, and a successful archive in a temporary root. Check that the proposal survives and no separate requirement files appear.
- Broken guidance: check current links, search skills for obsolete operations, run skill validation and documentation checks.

The plan received an independent simplification review before implementation. The schema update bootstraps this migration so its own artifacts use the final graph.

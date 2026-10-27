---
name: docs-refactor
description: Review or refactor existing project documentation to reduce maintenance, simplify structure, and improve progressive disclosure for people and agents. Use for substantive audits and cleanup, with review-only or refactor modes and independent subagent checks.
---

# Docs Refactor

Prefer documentation that costs less to maintain. Keep text short and well structured while preserving needed rules and context. No changes is a valid result.

Use ASD-STE100 Simplified Technical English for English documentation. Keep required technical terms, identifiers, and command syntax exact. Follow applicable project language rules.

## Modes and limits

Use this workflow for substantive documentation reviews and cleanup, not typos, minor wording edits, or new document authoring.

- `review`: inspect and report; do not edit target files.
- `refactor`: make supported changes and verify them.

Infer the mode from the request. Use `review` if intent is unclear. Stay within the requested scope; do not change code or product requirements. Preserve unrelated user edits.

Review and edit guides, overviews, and other in-scope documentation. Do not review or edit specifications, ADRs, or research documents. Specs may be read to clarify behavior; ADRs and research may be read as historical context. Reading these sources does not bring them into review scope. If source conflicts block a conclusion about an in-scope document, report that limit without starting a source-document audit.

Keep contracts, conditions, exceptions, required order, necessary procedures, and reasons for decisions. Preserve the project's distinction between current behavior, accepted decisions, plans, and history. Resolve conflicts from evidence and project rules; do not assume code always defines intended behavior. Report unresolved conflicts instead of silently choosing a new rule.

## Workflow

1. **Read rules and entry points.** Read applicable `AGENTS.md` files, including those for target subdirectories. Get project conventions, sources of authority, and required checks there. Start at the documented entry point, or the README and documentation index. For a documentation-wide review, first list the in-scope documents and identify excluded categories. Then follow the sources needed for this task.
2. **Assess.** Read the relevant sections of [criteria](references/criteria.md). Identify concrete maintenance or reader problems. Inspect code when needed to check claims or replace unnecessary implementation detail with a useful source path.
3. **Edit in refactor mode.** Make the smallest useful changes. When moving or removing content, check incoming links, relative paths, heading anchors, indexes, and agent entry points. Update affected references; report any that cannot be updated within scope.
4. **Verify.** Use the independent checks below. For edits, compare the result with the original for lost meaning and run checks required by the project. Do not run commands that change project state merely to test a documented procedure.
5. **Report.** In review mode, give findings with location, evidence, impact, and proposed action. In refactor mode, summarize changes, checks, and unresolved issues. For a documentation-wide review, state which documents were fully reviewed, partly reviewed, or not reviewed, with reasons for incomplete coverage. Distinguish excluded sources from unreviewed targets. Keep the report short, but do not reduce coverage to shorten it or fill a quota of findings.

## Independent checks

Use at least one independent, read-only subagent per run. Give it scope, mode, applicable project rules, source paths, and the relevant criteria. In refactor mode, include the original and final text or diff. The main agent owns edits and resolves findings against evidence.

One reviewer is the default. Add reviewers only for a concrete task, such as separate subject areas or a large set of documents that one reviewer cannot check well. Do not assign one agent per file.

A fresh-reader check is required after changes to navigation, information location, prerequisites, or action order. In review mode, use it when these are in question. Give a fresh subagent the entry point, access to the scoped docs, and a few realistic task questions. Do not give it the editing conversation, expected answers, or suspected defects. Ask for answers with sources, its reading route, and missing or unclear context. This check does not replace the review for lost meaning.

Use one review round, including the fresh-reader check when required. Fix supported findings and repeat checks only for substantial corrections or a specific remaining risk. Report unresolved matters; do not repeat for cosmetic preferences. If delegation is unavailable, check directly and disclose the missing independent review.

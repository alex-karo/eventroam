---
name: project-cleanup
description: Find and apply cleanup after Eventroam spec implementation. Remove unnecessary code and tests, check native framework features, and ask before substantial changes or requirement changes.
---

# Project Cleanup

Use after spec implementation, before final verification and archive, or on a
feature the user names. Find, apply, and check safe cleanup; do not stop at
recommendations. For an explicit review-only request, report without edits.
Remove complexity before reorganizing it. No changes is a valid result.

## Scope and evidence

Read project instructions and the documentation index. Identify the accepted
requirements, owning specs, and affected execution paths and consumers. Preserve
unrelated edits. A rule in an agent-written artifact alone does not prove user
acceptance; check the decision context.

Save a local comparison base before cleanup, including relevant untracked files,
without changing the user's index. Measure cleanup separately from prior edits.
Use [past cleanup lessons](references/past-cleanups.md) when relevant; these
examples are not current contracts or approval for new changes.

## Find simpler paths

For each substantial mechanism, identify its consumer and required outcome.
Look for duplicate state, statuses, reporting, logs, storage, and validation;
wrappers without application rules; test-only production options; obsolete
compatibility paths; and general infrastructure with one concrete use.

Keep external-input validation and checks of related state inside write
transactions. Before removing a safeguard, check accepted guarantees and real
failure evidence. Prefer fixing a cause to adding another limit or fallback.

Remove tests that repeat dependency behavior or other checks without detecting a
distinct failure. Explain which check retains the useful coverage, or why the
tested mechanism is obsolete. Keep distinct contract, transaction, data-loss,
and regression coverage. Do not remove tests because they fail or to meet a count.
For eval failures, separate agent errors, provider errors, fixture gaps, and
incorrect expectations.

For each substantial custom mechanism and each proposed framework replacement,
check native features in Next.js, React, Mastra, or the relevant dependency.
Verify installed versions against package docs, types, and source; use current
official docs when needed. Do not assume that a newer API is installed.
Record the custom path, native feature, source evidence, remaining application
rule, and lost behavior. Check lifecycle, ownership, errors, and correlation
where relevant.

Compare the whole replacement cost: code, configuration, dependencies, failure
modes, migration, and tests. A native feature or fewer lines alone does not prove
a simpler result. Propose upgrades, new services, and deployment changes
separately rather than adding them just to enable a replacement.

## Apply or ask

Apply local simplifications that preserve accepted behavior. Remove obsolete
callers, tests, and configuration with the code. Apply small fixes when they
restore established behavior without changing an accepted requirement.

Ask before changing requirements, scope, or guarantees, or making a substantial
change even if behavior is preserved. Judge importance by affected consumers,
regression risk, effort, and uncertainty, not line count. Examples include shared
architecture, storage or transaction ownership, and broad framework migrations.

Prepare a concrete decision: requirement and source, current and proposed
behavior, affected consumers, code and maintenance removed, losses, risks, and
recommended option. Complete and check independent safe cleanup first; continue
it while waiting. Leave the dependent change unapplied until approval. Do not
ask again for a change already approved in this conversation.

For approved behavior changes, follow the project's OpenSpec workflow unless
the user chose another workflow. Keep code, tests, specs, and affected docs aligned.

## Check and report

Run focused checks and required project checks. Use the built-in Browser for
local UI checks. Follow user authorization for paid model evals; fixture edits
alone do not require a model run. Check the final path for leftover callers,
duplicate mechanisms, and new complexity. Repeat only for a concrete remaining
problem. Cleanup does not replace code review or OpenSpec verification.

Compare with the saved base: added/removed lines, net change, and files
added/removed. Separate application code, tests, docs/specs, and material
generated-file or lockfile changes. Test deletion must not hide application-code
growth. If code grows, remove unnecessary additions or show a concrete benefit,
such as fewer paths or less state. Apply the approval rules above if the benefit
is uncertain or the replacement is substantial. Do not compress code or weaken
behavior to improve the count.

Report actions and results, code-size changes, framework evidence, preserved
behavior, checks and limits, and pending decisions. Distinguish measured results
from expected benefits. State when no useful cleanup was found.

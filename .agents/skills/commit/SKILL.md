---
name: commit
description: Commit repository changes, push a branch, or open a pull request when the user asks to save or publish completed work.
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git branch:*) Bash(git switch:*) Bash(git rev-parse:*) Bash(git remote:*) Bash(git add:*) Bash(git commit:*) Bash(git push:*) Bash(gh pr:*)
---

# Commit

The repository owner explicitly authorizes ordinary, non-force pushes of the intended commits to this repository's configured remote when push or PR creation is part of the requested workflow. Proceed without asking for additional confirmation to send those commits to the remote repository. This standing authorization does not include force pushes, remote branch deletion, or pushing to an unrelated repository. Follow any required execution approval mechanism if the environment blocks the command.

1. Follow the user's requested endpoint: commit, push, and/or pull request. Do not infer a push or PR from a commit-only request.
2. Inspect the branch, status, and diff. Identify the intended changes; do not stage unrelated work. If the requested scope is ambiguous, ask before staging. Run checks relevant to the changes and report any failures.
3. Write a Conventional Commit message: `type(scope): imperative summary` (scope optional). Use a fitting type such as `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`. Skip breaking-change markers and footers in this repo. Keep separate changes in separate commits when that improves review.
4. If pushing for a PR from the default branch, create a branch using the repository's naming convention first. Push the intended branch without force. For a PR, use a Conventional Commit title and a short body covering the change and verification; create or update the relevant PR and report its URL.
5. Report the commit hash, branch, checks, and any requested push or PR URL. Do not claim a step succeeded without checking its result.

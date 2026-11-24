---
type: Guide
title: Development guide
description: Local setup, common checks, and links to task guides.
status: stable
tags: [development]
---

# Development guide

Use this guide to start local work. Read only the task guide needed for your change.

## Local setup

Use the Node.js and pnpm versions pinned in `.node-version` and `package.json`. Install pnpm once with `npm install --global pnpm@12.15.0`. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run db:fixtures
pnpm run dev
```

Open `http://localhost:3000` for the project presentation or `http://festivals.localhost:3000` for discovery. Fixtures create a migrated database at `./data/eventroam.sqlite` and add repeatable fictional records.

Copy `.env.example` to `.env.local` for Next.js settings. A Mapbox token is optional locally; the list and filters work without one. Migration and fixture commands read the shell environment, not `.env.local`. For a custom database, run `DATABASE_PATH=./data/custom.sqlite pnpm run db:fixtures` and set the same path in `.env.local`. The Studio and eval launch commands load `.env`. The catalog CLI uses the running Studio's settings. Keep credentials in ignored local env files.

Codex worktrees use `.codex/environments/environment.toml` to link the source checkout’s `.env` and run `pnpm install --frozen-lockfile` in the new worktree. The setup requires the pinned Node.js and pnpm versions to be available on `PATH`.

Each worktree has its own dependency tree. pnpm shares package files through its content-addressable store. Keep `pnpm-workspace.yaml` with the lockfile; it lists the dependency build scripts allowed during installation.

Studio processes background ingestion while `pnpm run catalog:studio` is running. Use one Studio server per catalog. See [Background execution](ingestion-tools.md#background-execution) for storage, credentials, shutdown, and restart behavior.

## Analytics

See the [analytics guide](analytics.md) for PostHog settings, events, campaign links, and browser opt-out.

## Brand images

Edit [icon.svg](../src/app/icon.svg) for the logo and [generate-brand-assets.mjs](../scripts/generate-brand-assets.mjs) for social card text and layout. Run `pnpm run brand:generate` to update the ICO, device icons, avatar, and social cards. Commit the generated images with their sources. The website serves these files directly; the build does not generate them.

## Common checks

Run checks that apply to your change:

```sh
pnpm run type-check
pnpm run lint
pnpm test
pnpm run build
pnpm run docs:check
```

Use `pnpm run format:check` for application formatting and `pnpm run openspec:validate` for OpenSpec edits. See [Testing](testing.md) for browser tests, coverage, fixtures, and CI differences. See the [change workflow](change-workflow.md) when you use full OpenSpec or need help choosing a workflow.

## Code health

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and use a POSIX shell to run [Repowise](https://github.com/repowise-dev/repowise) locally.

```sh
npm run code:hotspots
npm run code:health -- --file src/ingestion/workflow.ts
```

The hotspot report groups files with high recent Git activity by component. The health report shows the score, metrics, and findings for the selected file. Omit `--file` for a repository summary.

The first run downloads the pinned Repowise version and builds an index from source files and Git history. Later runs update the index. Each worktree stores its index in the ignored `.repowise/` directory. Analysis runs offline. New indexes have editor integration and Git hook setup disabled.

To save the hotspot report as JSON, run `npm run code:hotspots -- --format json --out .repowise/hotspots.json`. With `pnpm run`, pass flags directly after the script name.

The Repowise CI job checks changed files in pull requests and pushes to `main`. It compares the pull request head with its merge base, or the push head with the previous tip of `main`. New high or critical code structure findings on changed lines outside test files fail the job. Repowise reports findings as GitHub annotations. This check needs only Git history.

To check committed changes locally, update `origin/main` and run this command:

```sh
npm run code:repowise -- health check origin/main...HEAD
```

## Task guides

| Task                                                         | Read                                      |
| ------------------------------------------------------------ | ----------------------------------------- |
| Find code owners and dependency boundaries                   | [Project structure](project-structure.md) |
| Plan or review a change                                      | [Change workflow](change-workflow.md)     |
| Test application or browser behavior                         | [Testing](testing.md)                     |
| Run research through CLI or Studio                           | [Ingestion tools](ingestion-tools.md)     |
| Understand source selection, field decisions, or publication | [Ingestion process](ingestion-process.md) |
| Run evals, inspect experiments, or compare models            | [Ingestion evals](ingestion-evals.md)     |
| Build containers, migrate data, or transfer a catalog        | [Infrastructure](infrastructure.md)       |

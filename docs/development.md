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

Use the Node.js and npm versions pinned in `.node-version` and `package.json`. From the repository root:

```sh
npm ci
npm run db:fixtures
npm run dev
```

Open `http://localhost:3000` for the project presentation or `http://festivals.localhost:3000` for discovery. Fixtures create a migrated database at `./data/eventroam.sqlite` and add repeatable fictional records.

Copy `.env.example` to `.env.local` for Next.js settings. A Mapbox token is optional locally; the list and filters work without one. Migration and fixture commands read the shell environment, not `.env.local`. For a custom database, run `DATABASE_PATH=./data/custom.sqlite npm run db:fixtures` and set the same path in `.env.local`. Catalog research, eval, and Studio commands load `.env`. Keep credentials in ignored local env files.

Codex worktrees use `.codex/environments/environment.toml` to link the source checkout’s `.env` and run `npm ci` in the new worktree. The setup requires the pinned Node.js and npm versions to be available on `PATH`.

## Analytics

See the [analytics guide](analytics.md) for PostHog settings, events, campaign links, and browser opt-out.

## Common checks

Run checks that apply to your change:

```sh
npm run type-check
npm run lint
npm test
npm run build
npm run docs:check
```

Use `npm run format:check` for application formatting and `npm run openspec:validate` for OpenSpec edits. See [Testing](testing.md) for browser tests, coverage, fixtures, and CI differences. Follow the [change workflow](change-workflow.md) for behavior changes and review.

## Task guides

| Task | Read |
| --- | --- |
| Find code owners and dependency boundaries | [Project structure](project-structure.md) |
| Plan or review a change | [Change workflow](change-workflow.md) |
| Test application or browser behavior | [Testing](testing.md) |
| Run research through CLI or Studio | [Ingestion tools](ingestion-tools.md) |
| Understand source selection, field decisions, or publication | [Ingestion process](ingestion-process.md) |
| Run evals, inspect experiments, or compare models | [Ingestion evals](ingestion-evals.md) |
| Build containers, migrate data, or transfer a catalog | [Infrastructure](infrastructure.md) |

---
type: Reference
title: Infrastructure
description: Remote deployment and database transfer commands.
status: stable
tags: [operations, infrastructure, database]
---

# Infrastructure

This repository owns application images and base Compose settings. Server
access, ingress, deployment settings, and secrets belong in private
infrastructure configuration. See
[Application containers](development.md#application-containers) for runtime inputs.

## Catalog pull and push

Stop local Next.js, Studio, and catalog commands first. Run one transfer at a
time, with no deployment or other database users active:

```sh
npm run db:pull -- --local-stopped  # Remote catalog to local
npm run db:push -- --local-stopped  # Local catalog to remote
```

Both commands load `.env`. `DATABASE_PATH` selects the local file (default
`./data/eventroam.sqlite`). Set `DB_SSH_HOST` in `.env`; there is no default host.
By default, only the catalog is transferred. Add `--with-mastra` to either command
to include workflow history, chats, and all stored logs, traces, and metrics:

```sh
npm run db:pull -- --local-stopped --with-mastra
npm run db:push -- --local-stopped --with-mastra
```

Mastra local paths use `CATALOG_WORKFLOW_DATABASE_PATH`,
`CATALOG_CHAT_DATABASE_PATH`, and `CATALOG_OBSERVABILITY_DATABASE_PATH`. Defaults
are `./data/mastra-workflows.sqlite`, `./data/mastra-chat.sqlite`, and
`./data/mastra-observability.duckdb`. Remote files use these names under `/data`.
All selected source files must exist. Use `tar` on the local machine and in the
Studio image.

The commands find the named volume mounted at `/data` in Studio and stop remote
services. They use the existing Studio image to prepare checked snapshots,
including committed SQLite and DuckDB WAL data. All target backups must succeed
before replacement starts. Each backup path is printed: local `backups/` beside
the database, or remote `/data/backups/`. Backups are kept; missing targets need
no backup. File replacements are separate operations. If replacement fails part
way through, use the backups to restore all selected targets before restart.

After success, previously running remote services restart. A failed pull also
restores remote service state; a failed push skips restart for manual recovery.
Local processes stay stopped. Transfers do not run migrations or wait for
service health. Use compatible application releases and check health afterward.

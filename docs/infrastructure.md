---
type: Reference
title: Infrastructure
description: Remote deployment and catalog transfer commands.
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
Only the catalog is transferred; other stores stay in place.

The commands find the named volume mounted at `/data` in Studio and stop remote
services. They use the existing Studio image to create and validate a SQLite
snapshot, then back up the target before replacement. The
backup path is printed: local `backups/` beside the database, or remote
`/data/backups/`. Backups are kept. A missing local target needs no backup.
A backup or validation failure prevents replacement.

After success, previously running remote services restart. A failed pull also
restores remote service state; a failed push skips restart for manual recovery.
Local processes stay stopped. Transfers do not run migrations or wait for
service health. Use compatible application releases and check health afterward.

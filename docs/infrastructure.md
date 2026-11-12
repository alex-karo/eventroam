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
infrastructure configuration. Use the procedures below for application containers and database transfers.

## Public website configuration

Set `PUBLIC_APEX_ORIGIN` and `PUBLIC_FESTIVALS_ORIGIN` to the public HTTPS origins. Local defaults are `http://localhost:3000` and `http://festivals.localhost:3000`. Compose maps these from `EVENTROAM_PUBLIC_APEX_ORIGIN` and `EVENTROAM_PUBLIC_FESTIVALS_ORIGIN`. Configured hosts control site selection and absolute identity URLs.

Each host serves `/robots.txt` and `/sitemap.xml`. Use [routes and scope](project-structure.md#routes-and-scope) to find metadata, indexing, sitemap, and Event JSON-LD code. Use [HTTP smoke checks](testing.md) to check the built application.

After deployment, verify ownership of both hosts in Google Search Console. Submit each host's sitemap and inspect representative root, Event, and Edition URLs. Check canonicals, indexing state, and structured-data reports. These account actions and real-data updates are separate from application checks.

## Application containers

One Dockerfile has `web` and `studio` targets. See `Dockerfile` for the pinned Node base image. Dependencies come from `pnpm-lock.yaml` and are installed for the target Linux architecture. The website uses Next standalone output. Studio includes its UI, Mastra's production Node server, and a separate migration command. No startup command runs migrations or loads fixtures.

Before running these commands:

- Stop all catalog users, including users outside this Compose project.
- Supply closed catalog and retained diagnostic files. Check file access for UID/GID 1000.
- Use images and schema from the same source version. Retain a compatible data copy if rollback is needed.
- Configure runtime inputs and external authentication before exposing Studio.

```sh
docker compose build &&
docker compose stop &&
docker compose run --rm --no-deps studio node commands/migrate.mjs &&
docker compose up -d --wait
```

Missing diagnostic stores are created empty. The migration command can also create an empty catalog for a temporary check. It is repeatable and returns nonzero on failure.

Compose declares one named volume, `data`, mounted at `/data` in both services. Keep the same Compose project name to retain it during recreation. Do not use `docker compose down --volumes` for retained data. The fixed container paths are:

- `/data/eventroam.sqlite`: catalog, public website reads, and validated Studio writes.
- `/data/mastra-workflows.sqlite`: Studio workflow history, including runs started by the CLI.
- `/data/mastra-observability.duckdb`: optional logs, traces, and metrics.
- `/data/mastra-chat.sqlite`: assistant conversation history.
- `/data/mastra-evals.sqlite`: saved eval datasets, experiments, and scores.

Both images run as `node` (UID/GID 1000). The volume directory and supplied files must permit this user to read and write, including SQLite WAL/shared-memory files and DuckDB WAL files. Website database connections stay read-only; the shared volume permits SQLite sidecar access. Only one process can own the DuckDB file. Stop Studio before any separate command opens that file.

Compose exposes web port 3000 and Studio port 4111 only on the Docker network. It publishes no host ports. Studio listens on `0.0.0.0:4111` and has no application login or credentials. Authentication for the complete public Studio host is an external ingress prerequisite. Network attachment, ingress authentication, DNS, TLS, Komodo, webhooks, and deployment automation belong in the self-hosted repository. Both services use `restart: unless-stopped`. Studio also processes queued ingestion jobs. Run one Studio server per catalog. To replace it, stop the old server before starting its replacement. Its 120-second Compose stop grace period permits workflow cancellation and cleanup. An interrupted job starts again after restart.

When upgrading from a deployment with a separate worker, stop and remove that worker before starting the new Studio server. Use `docker compose up -d --wait --remove-orphans` after stopping the old services. Update external deployment definitions to contain only web and Studio. Existing jobs stay in the catalog. Old worker diagnostic files remain separate historical data; the new server does not merge them.

The ingestion host must persist `data/ingestion-sources/` (or `CATALOG_SOURCE_DIRECTORY`) beside the private catalog and workflow stores. Source Markdown and evidence are required artifacts. Deleting run history does not remove them; cleanup is explicit. Keep this mount private and writable by the application user.

### Container inputs

Set `EVENTROAM_` inputs in the deployment environment or a private Compose env file. See [compose.yaml](../compose.yaml) for the names, mappings, and defaults.

- **Web build.** Set `EVENTROAM_MAPBOX_TOKEN` and `EVENTROAM_MAPBOX_STYLE` for maps. An empty token keeps discovery in list mode. Use the [analytics guide](analytics.md) for PostHog settings. Rebuild the web image after changes to these browser settings.
- **Web runtime.** Set the [public origins](#public-website-configuration) for deployment.
- **Studio runtime.** Supply provider credentials and model settings at runtime. Inspection needs no model key. Execution needs a migrated catalog and the provider settings for the selected run. Compose enables tracing and logging by default. Use its flags to disable either output.

Compose fixes the database paths under `/data`. For direct image use, use the application variable names under `environment` in [compose.yaml](../compose.yaml). Builds exclude owner databases, `.env` files, old output, and host dependencies.

For a production Studio build outside Docker, use temporary build storage, then select runtime storage explicitly:

```sh
DATABASE_PATH=/tmp/eventroam-build/catalog.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=/tmp/eventroam-build/history.duckdb CATALOG_WORKFLOW_DATABASE_PATH=/tmp/eventroam-build/workflows.sqlite CATALOG_CHAT_DATABASE_PATH=/tmp/eventroam-build/chat.sqlite pnpm run studio:build
DATABASE_PATH=./data/eventroam.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=./data/mastra-observability.duckdb CATALOG_WORKFLOW_DATABASE_PATH=./data/mastra-workflows.sqlite CATALOG_CHAT_DATABASE_PATH=./data/mastra-chat.sqlite pnpm run studio:start
```

`studio:start` serves the built UI and API on all interfaces without application authentication. It reads shell inputs; it does not load `.env`. Keep `pnpm run catalog:studio` for loopback development.

Both servers preserve default preview, explicit apply, native cancellation, and the existing unsupported-execution guards. Hosted inspection alone makes no model call.

### Health and image verification

Both images include Node health probes. Website `GET /health` returns `200 {"status":"ok"}` for a readable public schema or generic `503 {"status":"unavailable"}`. It does not create or migrate a missing catalog. Studio uses its existing `GET /health`. Its `GET /ingestion-queue` returns 200 while the queue loop runs, or 503 when catalog storage is unavailable. These internal checks need no model or login inputs.

Run `pnpm run docker:smoke` to build both targets, prepare an empty test catalog with one explicit migration, and wait for both container health checks to pass and check Studio queue startup with an empty queue and no provider keys. The script uses the application Compose file without host ports, a random project, and a temporary named volume. It supplies no owner data or provider credentials, makes no paid calls, and removes only its test project's containers and volume after success or failure. CI runs the same command instead of a separate host website build. Website health tests and full offline workflow execution remain outside the images.

### Replace supplied data

Use [Catalog pull and push](#catalog-pull-and-push) to replace the catalog. Follow the transfer prerequisites and plan for downtime.

Automatic backup schedules and recovery drills are deferred to the next iteration. Retained images permit code rollback only while catalog schema and DuckDB formats stay compatible. Image rollback does not reverse data changes; an incompatible migration needs a compatible saved data copy.

## Catalog pull and push

Stop local Next.js, Studio, and catalog commands first. Run one transfer at a
time. Keep other database users and deployment jobs stopped. The remote host
must have one web container and one Studio container in the `eventroam` Compose
project. Studio must use a named volume at `/data`.

If a push needs a migration before startup, stop web and Studio on the remote
host before the push and leave their containers in place. After the push,
apply the migration, start the matching release, and check service health.

```sh
pnpm run db:pull --local-stopped  # Remote catalog to local
pnpm run db:push --local-stopped  # Local catalog to remote
```

Both commands load `.env`. `DATABASE_PATH` selects the local file (default
`./data/eventroam.sqlite`). Set `DB_SSH_HOST` in `.env`; there is no default host.
By default, only the catalog is transferred. Add `--with-mastra` to either command
to include workflow history, chats, and all stored logs, traces, and metrics:

```sh
pnpm run db:pull --local-stopped --with-mastra
pnpm run db:push --local-stopped --with-mastra
```

Mastra local paths use `CATALOG_WORKFLOW_DATABASE_PATH`,
`CATALOG_CHAT_DATABASE_PATH`, and `CATALOG_OBSERVABILITY_DATABASE_PATH`. Defaults
are `./data/mastra-workflows.sqlite`, `./data/mastra-chat.sqlite`, and
`./data/mastra-observability.duckdb`. Remote files use these names under `/data`.
Transfer saved evals and [private source evidence](ingestion-tools.md#saved-source-evidence) separately when needed. Saved runs refer to source files for inspection.
All selected source files must exist. Use `tar` on the local machine and in the
Studio image.

The commands find the named volume mounted at `/data` in Studio and stop remote
web and Studio services. They use the existing Studio image to prepare checked snapshots,
including committed SQLite and DuckDB WAL data. All target backups must succeed
before replacement starts. Each backup path is printed: local `backups/` beside
the database, or remote `/data/backups/`. Backups are kept; missing targets need
no backup. File replacements are separate operations. If replacement fails part
way through, use the backups to restore all selected targets before restart.

After success, the script restarts the remote services that were running when
the transfer began. A failed pull also restores remote service state. After a
failed push, inspect the target and its backups before you restart. Local
processes stay stopped. The transfer replaces files with snapshots. Run any
needed migrations separately and check health after startup.

## Local database maintenance

`pnpm run db:migrate` applies reviewed migrations to `DATABASE_PATH`, including the [starter taxonomy](proposals/festival-taxonomy-vocabulary.md). Existing terms and Edition assignments are preserved; new terms do not classify or publish records. `pnpm run db:fixtures` also loads fictional development data. Fixtures are separate from schema migrations and omit audit history. Normal catalog mutations must use the validated writer; seed loaders must use shared catalog validators.

Migration files live in `src/db/migrations/`. A database from the earlier nine-migration history must be recreated; `db:migrate` does not upgrade it.

Before replacing a database:

1. Stop all processes that use it.
2. Preserve valuable research data with a consistent SQLite backup. Keep that backup separate for manual recovery. SQLite's backup API includes committed WAL data; copying only a live main file is insufficient.
3. Verify the backup with `PRAGMA integrity_check`.
4. For a disposable database, recreate fictional data with `pnpm run db:fixtures`. Use `pnpm run db:migrate` for an empty catalog with starter vocabulary.

Historical reports remain opaque storage. See the [report contracts](../src/ingestion/report.ts) for supported report versions.

For transfers between the local machine and the remote Compose volume, see
[Catalog pull and push](#catalog-pull-and-push).

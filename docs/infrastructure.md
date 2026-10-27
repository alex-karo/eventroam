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

Each host serves `/robots.txt` and `/sitemap.xml`. The [website discoverability spec](../openspec/specs/website/discoverability/spec.md) defines metadata, indexing, sitemap contents, and Event JSON-LD eligibility. Use [HTTP smoke checks](testing.md) to check the built application.

After deployment, verify ownership of both hosts in Google Search Console. Submit each host's sitemap and inspect representative root, Event, and Edition URLs. Check canonicals, indexing state, and structured-data reports. These account actions and real-data updates are separate from application checks.

## Application containers

One Dockerfile has `web` and `studio` targets. See `Dockerfile` for the pinned Node base image. Dependencies come from `package-lock.json` and are installed for the target Linux architecture. The website uses Next standalone output. Studio includes its UI, Mastra's production Node server, and a separate migration command. Neither startup command runs migrations or loads fixtures.

Before running these commands:

- Stop all catalog users, including users outside this Compose project.
- Supply closed catalog and retained diagnostic files. Check file access for UID/GID 1000.
- Use images and schema from the same source version. Retain a compatible data copy if rollback is needed.
- Configure runtime inputs and external authentication before exposing Studio.

```sh
docker compose build
docker compose stop
docker compose run --rm --no-deps studio node commands/migrate.mjs
docker compose up -d --wait
```

Missing diagnostic stores are created empty. The migration command can also create an empty catalog for a temporary check. It is repeatable and returns nonzero on failure.

Compose declares one named volume, `data`, mounted at `/data` in both services. Keep the same Compose project name to retain it during recreation. Do not use `docker compose down --volumes` for retained data. The fixed container paths are:

- `/data/eventroam.sqlite`: catalog, public website reads, and validated Studio writes.
- `/data/mastra-workflows.sqlite`: native CLI and Studio workflow history.
- `/data/mastra-observability.duckdb`: optional logs, traces, and metrics.
- `/data/mastra-chat.sqlite`: assistant conversation history.
- `/data/mastra-evals.sqlite`: saved eval datasets, experiments, and scores.

Both images run as `node` (UID/GID 1000). The volume directory and supplied files must permit this user to read and write, including SQLite WAL/shared-memory files and DuckDB WAL files. Website database connections stay read-only; the shared volume permits SQLite sidecar access. Only one process can own the DuckDB file. Stop Studio before any separate command opens that file.

Compose exposes web port 3000 and Studio port 4111 only on the Docker network. It publishes no host ports. Studio listens on `0.0.0.0:4111` and has no application login or credentials. Authentication for the complete public Studio host is an external ingress prerequisite. Network attachment, ingress authentication, DNS, TLS, Komodo, webhooks, and deployment automation belong in the self-hosted repository. Both services use `restart: unless-stopped`.

### Container inputs

Compose reads deployment inputs with `EVENTROAM_` and maps them to current application names. Existing local `.env` names and defaults stay unchanged. Set these inputs in the deployment environment or a selected Compose env file; do not commit credentials.

| Deployment input | Use |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVENTROAM_MAPBOX_TOKEN`, `EVENTROAM_MAPBOX_STYLE` | Website build arguments mapped to `NEXT_PUBLIC_MAPBOX_TOKEN` and `NEXT_PUBLIC_MAPBOX_STYLE`. Empty token keeps list-only use; the style defaults to Mapbox streets-v12. Rebuild to change either value. |
| `EVENTROAM_PUBLIC_APEX_ORIGIN`, `EVENTROAM_PUBLIC_FESTIVALS_ORIGIN` | Runtime `PUBLIC_APEX_ORIGIN` and `PUBLIC_FESTIVALS_ORIGIN`; defaults match local development. Set the public origins for deployment. |
| `EVENTROAM_OPENROUTER_API_KEY`, `EVENTROAM_FIRECRAWL_KEY`, `EVENTROAM_GEOAPIFY_KEY` | Runtime Studio provider credentials. These credentials are not build arguments. Inspection needs no model key. Execution needs the migrated catalog and its usual provider settings. |
| `EVENTROAM_OPENROUTER_MODEL`, `EVENTROAM_OPENROUTER_SERVICE_TIER`, `EVENTROAM_OPENROUTER_REASONING_EFFORT` | Runtime model selection; empty values keep the current application defaults. |
| `EVENTROAM_CATALOG_LOCATION_MODEL` | Runtime `CATALOG_LOCATION_MODEL`; empty uses the normal model. |
| `EVENTROAM_CATALOG_TRACING`, `EVENTROAM_CATALOG_LOGGING`, `EVENTROAM_CATALOG_LOG_LEVEL` | Existing diagnostics, all off by default except log level `info`. |
| `EVENTROAM_CATALOG_MAX_SEARCHES`, `EVENTROAM_CATALOG_MAX_SEARCH_RESULTS`, `EVENTROAM_CATALOG_MAX_AGENT_STEPS`, `EVENTROAM_CATALOG_MAX_DURATION_MS`, `EVENTROAM_CATALOG_MAX_PAGE_BYTES`, `EVENTROAM_CATALOG_MAX_MODEL_OUTPUT_TOKENS` | Existing execution limits; empty values keep the application defaults. |

Database paths are Compose constants, without deployment inputs. Direct image use can set the `DATABASE_PATH`, `CATALOG_WORKFLOW_DATABASE_PATH`, `CATALOG_OBSERVABILITY_DATABASE_PATH`, and `CATALOG_CHAT_DATABASE_PATH` runtime names. Builds exclude owner databases, `.env` files, old output, and host dependencies. Only the public Mapbox token and style enter browser assets.

For a production Studio build outside Docker, use temporary build storage, then select runtime storage explicitly:

```sh
DATABASE_PATH=/tmp/eventroam-build/catalog.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=/tmp/eventroam-build/history.duckdb CATALOG_WORKFLOW_DATABASE_PATH=/tmp/eventroam-build/workflows.sqlite CATALOG_CHAT_DATABASE_PATH=/tmp/eventroam-build/chat.sqlite npm run studio:build
DATABASE_PATH=./data/eventroam.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=./data/mastra-observability.duckdb CATALOG_WORKFLOW_DATABASE_PATH=./data/mastra-workflows.sqlite CATALOG_CHAT_DATABASE_PATH=./data/mastra-chat.sqlite npm run studio:start
```

`studio:start` serves the built UI and API on all interfaces without application authentication. It reads shell inputs; it does not load `.env`. Keep `npm run catalog:studio` for loopback development. Both servers preserve default preview, explicit apply, native cancellation, and the existing unsupported-execution guards. Hosted inspection alone makes no model call.

### Health and image verification

Both images include Node health probes. Website `GET /health` returns `200 {"status":"ok"}` for a readable public schema or generic `503 {"status":"unavailable"}`. It does not create or migrate a missing catalog. Studio uses its existing `GET /health`. These internal checks need no model or login inputs.

Run `npm run docker:smoke` to build both targets, prepare an empty test catalog with one explicit migration, and wait for both container health checks to pass. The script uses the application Compose file without host ports, a random project, and a temporary named volume. It supplies no owner data or provider credentials, makes no paid calls, and removes only its test project's containers and volume after success or failure. CI runs the same command instead of a separate host website build. Website health tests and full offline workflow execution remain outside the images.

### Replace supplied data

Use [Catalog pull and push](#catalog-pull-and-push) to replace the catalog with a checked snapshot and keep a target backup. Add `--with-mastra` to include workflow history, chats, and stored diagnostics. Stop all database users before transfer. The commands do not merge data or run migrations. Run any required migrations while users remain stopped, then start the matching release. Short downtime is expected.

Automatic backup schedules and recovery drills are deferred to the next iteration. Retained images permit code rollback only while catalog schema and DuckDB formats stay compatible. Image rollback does not reverse data changes; an incompatible migration needs a compatible saved data copy.

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
Saved eval datasets and experiments are not included in these transfers.
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

## Local database maintenance

`npm run db:migrate` applies reviewed migrations to `DATABASE_PATH`, including the [starter taxonomy](proposals/festival-taxonomy-vocabulary.md). Existing terms and Edition assignments are preserved; new terms do not classify or publish records. `npm run db:fixtures` also loads fictional development data. Fixtures are separate from schema migrations and omit audit history. Normal catalog mutations must use the validated writer; seed loaders must use shared catalog validators.

Migration files live in `src/db/migrations/`. A database from the earlier nine-migration history must be recreated; `db:migrate` does not upgrade it.

Before replacing a database:

1. Stop all processes that use it.
2. Preserve valuable research data with a consistent SQLite backup. Keep that backup separate for manual recovery. SQLite's backup API includes committed WAL data; copying only a live main file is insufficient.
3. Verify the backup with `PRAGMA integrity_check`.
4. For a disposable database, recreate fictional data with `npm run db:fixtures`. Use `npm run db:migrate` for an empty catalog with starter vocabulary.

Historical reports remain opaque storage; current report and eval consumers do not support them. See the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for storage rationale.

For catalog transfer between the local machine and the remote Compose volume,
see [Catalog pull and push](#catalog-pull-and-push). Both commands
keep a target backup before replacement. Add `--with-mastra` to include workflow
history, chats, and stored diagnostics.

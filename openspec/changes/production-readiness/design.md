# Design

## Context

Size: Medium. The website reads SQLite; local Studio runs `mastra dev` with a separate DuckDB store. Production images, startup commands, and health checks are missing. See [proposal.md](proposal.md) for scope and the delta specs for behavior.

## Goals / Non-Goals

**Goal:** Build without owner data or credentials, then run both services against supplied persistent files.

**Non-goals:** Real rollout or data transfer, external infrastructure or deployment automation, backups and recovery drills, data merging, read-only Studio roles, and `public-site-launch` SEO work.

## Decisions

### Images

Use one multi-stage Dockerfile with `web` and `studio` targets from one source and lockfile. Separate processes avoid extra supervision and keep Studio dependencies out of the website. The Studio image also carries the separate migration command.

- Use ADR 002's exact Debian-based Node runtime and a verified image digest. Install native dependencies in Linux for the target architecture.
- Package Next standalone output, static assets, and native SQLite. Build Studio with Mastra `build --studio`; include its assets and required runtime dependencies.
- Exclude `.env*` except the example, owner data, debug output, `node_modules`, and old builds from the context. Mastra opens storage at import: use disposable build storage and copy only runtime output. Do not load fixtures.

### Environment inputs

Keep existing application environment names, defaults, validation, and local commands. `compose.yaml` maps deployment inputs with `EVENTROAM_` to those names; no application-wide rename or alias layer is needed.

| Compose input | Application input |
| --- | --- |
| `EVENTROAM_MAPBOX_TOKEN`, `EVENTROAM_MAPBOX_STYLE` | Build-only `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_MAPBOX_STYLE` |
| `EVENTROAM_PUBLIC_APEX_ORIGIN`, `EVENTROAM_PUBLIC_FESTIVALS_ORIGIN` | `PUBLIC_APEX_ORIGIN`, `PUBLIC_FESTIVALS_ORIGIN` |
| Prefixed provider, diagnostic, and limit inputs | Existing `OPENROUTER_*`, `FIRECRAWL_KEY`, and other `CATALOG_*` settings |

Docker accepts `EVENTROAM_MAPBOX_TOKEN` and `EVENTROAM_MAPBOX_STYLE` build arguments and sets the existing `NEXT_PUBLIC_MAPBOX_*` names only for the website build. Keep current empty-token/default-style behavior. Map changes need a rebuild; private credentials never enter build arguments or browser assets.

Compose sets `DATABASE_PATH=/data/eventroam.sqlite` and Studio's `CATALOG_OBSERVABILITY_DATABASE_PATH=/data/mastra-observability.duckdb` directly. Database paths and the host storage directory need no deployment inputs.

Reuse current origin selection and canonical links without production host constants. Derive the bundled Studio asset path internally. Set its fixed listener and same-origin flag in the production entry point.

### Compose

Store application `compose.yaml` here with `web` and `studio` services, build targets, environment mappings, and service ports on the Docker network. Do not publish Studio's port to the host. Declare one named volume, `data`, mounted at `/data` in both services and the separate migration command. Keep the same Compose project for container recreation so it uses the same volume. Keep host ingress and external-network attachment in the self-hosted configuration, without Caddy, DNS, Komodo, or webhook settings here.

Set `restart: unless-stopped` on both services so they restart after failure or a Docker daemon restart, while an explicit stop remains effective.

Use Compose to build and start the matching images. Run migrations explicitly with `docker compose run --rm --no-deps studio <migration-command>` while catalog users are stopped; do not add an always-running migration service. Keep provider secrets as runtime inputs. Image builds and Studio inspection require no model credentials.

### Studio access and lifecycle

Treat Studio as a trusted-network service without application authentication or login inputs. Public access depends on authentication at the external ingress. Its configuration, credentials, and checks belong in the self-hosted repository.

Listen at fixed `0.0.0.0:4111`; keep local `catalog:studio` at `127.0.0.1:4111`. Set internal `MASTRA_AUTO_DETECT_URL=true` before import so browser API requests use `window.location.origin`. HTTPS setup is external; no public Studio address inputs are needed.

Use `createNodeServer` from `@mastra/deployer/server` with production mode and bundled Studio assets. Reuse its worker startup, signal handling, bounded HTTP drain, and Mastra shutdown instead of a separate HTTP wrapper or lifecycle implementation. Disable unused browser-stream support. Preserve existing owner operations, execution prerequisites, and unsupported-execution guards; inspection needs no model key. Verify that shutdown closes storage.

### Data and migrations

Store `/data/eventroam.sqlite` and `/data/mastra-observability.duckdb` with their WAL and shared-memory files in the named volume. Supply the initial database files before starting services; normal startup does not populate them. Permit required writes by the non-root runtime user. Keep website reads through `openReadDatabase`, validated Studio writes, and one owner per DuckDB file.

Wrap existing `migrateDatabase()` in a separate command. It retains integrity checks and connection cleanup. Package `./src/db/migrations` at the expected working path, or make that shared path explicit. Migrations are repeatable, fail nonzero, and never run at build or service startup.

Stop all relevant source and destination users before migration or replacement; short downtime is accepted. Initial data contains only the two database files, without separate reports or debug directories. Replacement in either direction uses closed, consistent files with handled WAL state, SQLite integrity checks, and a DuckDB open check. There is no merge or transfer service.

### Verification

Website health opens the catalog read-only and probes the public schema; missing or incompatible data returns generic unavailable status without creation, migration, or record disclosure. Studio uses its existing health endpoint on the container network. Node health probes require no authentication inputs.

Keep application tests separate from the image startup check:

| Check | Required coverage |
| --- | --- |
| Configuration review | Check Compose input mappings, fixed database paths, volume use, and network exposure against the release spec. |
| Offline transport, outside Docker | Run the existing fixture through the production server setup and Mastra lifecycle. Check inspection without a model key, preview/apply, cancellation, unsupported execution, and storage closure. |
| Website health, outside Docker | Use real SQLite files to check valid, missing, and incompatible schemas, generic responses, and no catalog creation or mutation. |
| Images | Build both targets, prepare an empty test catalog with one explicit migration, and wait for both container health checks to pass. |

Use one local/CI Compose smoke script with a random project and an isolated temporary named volume. Reuse the application Compose file without publishing host ports. Build the images, run the migration once to prepare the test catalog, and use `docker compose up --wait` to check startup and container health. Remove only the test project's containers and volume after success or failure. Use no owner data or provider credentials, call no paid providers, and fail nonzero when a command or health check fails. Replace CI's host `pnpm run build` with this command; keep other checks. Full workflow execution stays in offline transport tests, outside release images.

## Risks / Trade-offs

- Image smoke checks startup and health only. Asset delivery, API behavior, origins, map settings, saved history, shutdown, and recreation have no image smoke assertions.
- Shutdown can interrupt ingestion or leave storage open → retain offline transport and storage-closure checks, plus restart-from-current-state behavior without resume or replay.
- Image dependencies used only during ingestion can escape smoke checks → accepted gap because full offline execution stays outside Docker.
- Backups and recovery drills are deferred → retain consistent-copy rules without claiming disaster recovery.

## Migration Plan

Verify image startup using an empty catalog in an isolated named volume: migrate with services stopped, then start both images and wait for their health checks.

Document Compose inputs and commands in the current guides, including the Mapbox gate. Keep existing local input names. Document commands, inputs, the external authentication prerequisite, storage permissions, replacement, and single DuckDB ownership. Align ADR 001 with deferred recovery tests while preserving WAL rules; record verified images and commands in ADR 002. Sync main specs and status text only after implementation verification. Ingress authentication, external secret-store mappings, and Mapbox account controls remain outside this change.

Keep prior images for code rollback only while schema and DuckDB formats remain compatible. An incompatible migration needs a compatible saved data copy; image rollback does not reverse data changes.

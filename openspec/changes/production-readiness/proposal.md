# Proposal

## Why

The owner needs production Docker images for the public catalog and Studio behind external authentication, using existing data. Only local commands are available today.

## What Changes

- Package the website, Studio, and a separate migration command from one source version. Provide `compose.yaml` for the application services.
- Keep supplied catalog and Studio history files in one named Docker volume; builds and restarts do not load fixtures or replace data.
- Document public origins, map build inputs, fixed container database paths, and Studio access.
- Use `EVENTROAM_` for Compose inputs and Docker build arguments; map them to current application names. Keep local commands and their environment contract unchanged.
- Run Studio on the Docker network without application authentication or a published host port. Keep existing owner operations and local use.

## Capabilities

### New Capabilities

- `operations/release-operations`: Production images, persistent data, configuration, health, and Studio access.

### Modified Capabilities

- `catalog/ingestion-workflow`: Add hosted Studio access behind external authentication with existing ingestion rules.
- `operations/ingestion-diagnostics`: Add hosted inspection without model calls.

## Impact

Docker and Compose configuration, production startup, focused tests, and current guides. Public routing and catalog rules stay unchanged.

External infrastructure, ingress authentication, and deployment automation belong in the self-hosted repository. This change does not configure, test, or deploy them. Backups and recovery drills are deferred; consistent database-copy rules still apply.

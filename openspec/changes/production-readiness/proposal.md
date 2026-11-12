# Proposal

## Why

The owner needs production Docker images for the public catalog and Studio behind external authentication, using existing data. Only local commands are available today.

## What Changes

- Provide production Docker images and Compose commands for the website, Studio, and explicit catalog migrations.
- Retain supplied catalog data and Studio history across rebuilds and container replacement.
- Document deployment settings, public origins, map inputs, Studio access, and migration steps.
- Keep local operation compatible and let hosted Studio use external ingress authentication.

## Requirements

- Operators can run production website and Studio images from one source version without a source checkout or development server.
- Supplied catalog data and Studio history survive container replacement. Builds and service startup do not load fixtures, replace data, or migrate the catalog.
- Operators run catalog migrations explicitly with services stopped. Repeated runs are safe, and failures return a nonzero exit status.
- Document deployment settings, public origins, map settings, and credentials. Keep current local commands and settings compatible, and exclude private credentials from browser assets.
- Hosted Studio works behind external ingress authentication without another application login or a published host port. Browser requests use the Studio public origin.
- Existing owner workflows and saved inspection remain available locally and in hosted Studio. Inspection needs no model credentials, new research, or active catalog connection.
- Operators can check website and Studio availability without changing data or exposing private state. Existing history privacy rules continue to apply.

## Acceptance criteria

- Built services start from documented settings and supplied data without installing packages or running development watchers.
- Recreated containers retain the catalog and Studio history. A missing or incompatible catalog fails website health without creating or replacing data.
- The migration command succeeds on first and repeated runs with valid data, retains integrity checks, and reports failure through its exit status.
- One website image supports the configured public origins. Documented map settings reach the browser without private credentials.
- Studio is usable through its public HTTPS origin without application login inputs or a host-port binding.
- Local and hosted preview, apply, cancellation, and saved inspection retain their existing behavior. Inspection still works after process exit without new provider calls or evidence retrieval; missing evidence is reported as missing.
- Health checks report service availability without changing the catalog or revealing records, credentials, or saved observations.

## Impact

Operators gain documented production startup, migrations, and health checks. Readers and the Studio owner use configured public origins; existing routing and catalog rules remain applicable.

External infrastructure, ingress authentication, and deployment automation belong in the self-hosted repository. This change does not configure, test, or deploy them. Backups and recovery drills are deferred; consistent database-copy rules still apply.

# Proposal

## Why

As the catalog owner, I need a public release that starts the web application against durable SQLite data and can be backed up and restored. The current service runs with development fixtures and has no production packaging or verified Mapbox account controls.

## What Changes

- Package the web application, catalog writer, and reviewed migrations as one compatible release with durable SQLite storage.
- Establish repeatable deployment, backup, restoration, and health checks.
- Configure launched domains and TLS, and satisfy the documented Mapbox token and usage gate before public exposure.

## Capabilities

### New Capabilities

- `operations/release-operations`: Startup, persistence, recovery, and external-service gates for a public release.

### Modified Capabilities

None. The current product and public-route requirements remain in their existing capabilities.

## Impact

Container packaging and operations, persistent database storage, deployed origins, and the Mapbox account. Hosting vendor and concrete ingress, backup destination, schedule, and monitoring service remain deployment decisions in [ADR 002](../../../docs/decisions/002-runtime-and-tooling.md); design and tasks will follow them.

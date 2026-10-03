# Spec Delta

## Purpose

Keeps the public catalog available with compatible application and schema versions, durable storage, recoverable backups, and verified external-service configuration.

## ADDED Requirements

### Requirement: Release components use one compatible version
The system SHALL deploy the web application, catalog writer, and reviewed schema migrations as a compatible release, with repeatable startup and health checks.

#### Scenario: Schema change deployment
- **WHEN** a release includes a database schema change
- **THEN** operators can back up the database, apply the reviewed migration, and start matching web and writer versions

### Requirement: SQLite data is durable and recoverable
The system SHALL keep the live catalog on persistent storage and provide a consistent backup and tested restore procedure that accounts for SQLite WAL state.

#### Scenario: Recovery drill
- **WHEN** operators restore a backup to a clean environment
- **THEN** the restored catalog can be read by the matching application without losing committed records

### Requirement: Public map access has verified account controls
The system SHALL verify Mapbox token restrictions, launch-host allowlists, usage monitoring, and budget alerts before public deployment.

#### Scenario: Launch gate
- **WHEN** any required Mapbox account-side control is unverified
- **THEN** the public deployment gate remains incomplete

### Requirement: Only configured launched hosts serve the catalog
The system SHALL configure TLS and public origins for launched domains without exposing an unlaunched scope as an active catalog.

#### Scenario: Unlaunched scope
- **WHEN** a request targets a future scope host before that scope launches
- **THEN** the deployment does not serve an indexable placeholder catalog for it

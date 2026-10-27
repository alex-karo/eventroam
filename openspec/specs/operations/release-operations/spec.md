# Release operations

## Purpose

Defines how the website and Studio run from production images with supplied data, explicit configuration, and Studio access through a trusted network.

## Requirements

### Requirement: Release components use one compatible version

The project SHALL provide production image targets for the website and Studio, plus a separate catalog migration command built from the same source version. Their runtime dependencies and reviewed migrations SHALL be included without requiring the source checkout or a development server.

#### Scenario: Start a release without the source checkout

- **WHEN** the owner starts the built images with their documented configuration and persistent files
- **THEN** the website and Studio run without installing packages or starting development watchers

### Requirement: Runtime data stays outside images

The website and Studio SHALL use the supplied catalog file. Studio SHALL use separate workflow history and observability files. Compose SHALL store all three files and their database sidecar files in one named volume at `/data`. Builds and normal startup SHALL NOT import development fixtures, replace these files, or require them as build inputs.

#### Scenario: Recreate the services

- **WHEN** containers are recreated with the same named volume
- **THEN** public records remain at `/data/eventroam.sqlite`, workflow history at `/data/mastra-workflows.sqlite`, and observations at `/data/mastra-observability.duckdb`

#### Scenario: The supplied catalog is missing

- **WHEN** the website starts without an existing catalog at its configured path
- **THEN** its health check fails and it does not create a catalog or load fixtures

#### Scenario: Workflow history is empty on first start

- **WHEN** Studio starts with an existing catalog and observability store but no workflow store
- **THEN** it creates an empty workflow store without importing old reports or replacing existing data

### Requirement: Catalog migrations are explicit

The release SHALL provide a separate, repeatable migration command for the selected catalog. Normal website and Studio startup SHALL NOT migrate the catalog. A failed migration SHALL return a nonzero exit status. The owner SHALL run migrations without concurrent catalog access.

#### Scenario: Migrate a supplied catalog

- **WHEN** the owner runs the release migration command against a compatible catalog with the services stopped
- **THEN** reviewed migrations and existing integrity checks run without loading fixtures

### Requirement: Runtime configuration selects paths and public origins

The images SHALL accept documented runtime inputs for database paths, public origins, and provider credentials. Website links and host selection SHALL use the existing configured-origin contract. A database path or private credential SHALL NOT need to be embedded in an image.

#### Scenario: Use the same image with different origins

- **WHEN** the owner starts the website image with different public origins and a supplied catalog
- **THEN** host selection and absolute links use those runtime origins

### Requirement: Compose maps deployment inputs to application settings

The release SHALL provide a Compose definition for the website and Studio. Compose inputs and application Docker build arguments SHALL use `EVENTROAM_`. Compose SHALL map runtime values to the application's environment names. Existing local input names, defaults, and validation SHALL remain unchanged.

#### Scenario: Configure application services with Compose

- **WHEN** the owner supplies documented `EVENTROAM_` inputs to Compose
- **THEN** the services receive the corresponding application settings without changes to local command configuration

### Requirement: Public map settings are build inputs

The website image build SHALL accept `EVENTROAM_MAPBOX_TOKEN` and `EVENTROAM_MAPBOX_STYLE` for the public browser map. The built website SHALL use those inputs to load the map. Private credentials SHALL NOT enter browser assets.

#### Scenario: Build with a map token

- **WHEN** the website image is built with a valid public map token and style
- **THEN** its browser assets use those map settings without needing the token as a runtime-only input

### Requirement: Production Studio runs on a trusted network

Studio SHALL serve its UI, assets, API, and health endpoint without application authentication or login inputs. The application Compose definition SHALL NOT publish Studio's port to the host. Authentication at the public ingress is an external deployment prerequisite.

#### Scenario: Start Studio on the application network

- **WHEN** the owner starts Studio with its documented configuration and no application login inputs
- **THEN** its endpoints are available on the Docker network and the application Compose definition has no Studio host-port binding

### Requirement: Hosted Studio uses its public origin

The hosted Studio UI SHALL call its API through the same origin used to open the UI without using the internal container address.

#### Scenario: Use the hosted Studio UI

- **WHEN** the owner opens Studio through its HTTPS origin
- **THEN** the UI calls its API through that same origin without using the internal container address

### Requirement: Hosted Studio preserves existing owner operations

Hosted Studio SHALL retain the existing inspection and owner-initiated execution features without a read-only role or changes to preview, apply, cancellation, or the existing unsupported-execution guards. Inspection SHALL require no model key; execution SHALL require its existing prerequisites.

#### Scenario: Inspect history without a model key

- **WHEN** the owner inspects saved Studio history on the trusted network without model credentials
- **THEN** saved history and observations are available without a new model call

#### Scenario: Start preview and apply in hosted Studio

- **WHEN** the owner submits a valid operation with execution prerequisites
- **THEN** preview remains the default and apply requires an explicit request

### Requirement: Release health can be checked without changing data

The website SHALL provide a health check that fails when its configured catalog cannot be read with the required schema. Studio SHALL provide a health check for its running service on the container network. Health requests SHALL NOT start ingestion or expose catalog records, credentials, or saved observations.

#### Scenario: Check service health

- **WHEN** the services run with valid configuration and data
- **THEN** their documented health checks succeed without a catalog mutation or model call

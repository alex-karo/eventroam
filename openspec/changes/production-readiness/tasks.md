# Tasks

Use [design decisions](design.md#decisions) for implementation details and the [verification table](design.md#verification) for required coverage.

## 1. Studio

- [x] 1.1 Add the production Studio entry point using Mastra's Node server, fixed listener, bundled assets, and same-origin API. Reuse its worker startup and shutdown. Pass startup and served-asset checks without login inputs, plus offline transport and storage-closure checks through the same server setup outside Docker. Retain local loopback use.
- [x] 1.2 Document the Studio command, execution prerequisites, storage ownership, and external authentication prerequisite in current guides. Verify local commands and run `npm run docs:check`.

## 2. Docker and Compose

- [x] 2.1 Add Dockerfile targets, `.dockerignore`, and standalone website packaging. Pass clean Linux builds without owner data or private credentials; verify native dependencies through the shared Compose smoke scenario.
- [x] 2.2 Package the migration wrapper and files in Studio. Verify first/repeated runs, nonzero failure, and no fixtures or automatic startup migrations.
- [x] 2.3 Add application `compose.yaml` with `EVENTROAM_` input mappings, build targets, one named `data` volume at `/data`, fixed database paths, and `restart: unless-stopped` on both services. Map Docker map arguments to existing browser keys. Validate no Studio host-port binding, builds without credentials, built map assets, runtime origins, and private-value exclusion.
- [x] 2.4 Document image and Compose commands, inputs, permissions, migration, and replacement; update ADRs as described in the design's migration plan. Run `npm run docs:check`.

## 3. Health and image checks

- [x] 3.1 Add website health and Node image probes. Pass health checks for valid, missing, and incompatible data without data creation or information disclosure.
- [x] 3.2 Limit the shared Compose smoke script to image builds, one migration to prepare an empty catalog, and startup with container health checks. Use an isolated temporary named volume, no host ports, no owner inputs, and cleanup after success or failure. Update current smoke documentation and verify the command.
- [x] 3.3 Replace CI's host build with image builds and smoke checks; keep other checks. Verify temporary data, no paid calls, and nonzero failure. Document the command and run `npm run docs:check`.

## 4. Integration

- [x] 4.1 Run relevant type, lint, dependency, unit/transport, image build/smoke, documentation, and OpenSpec checks. Verify operation without a source checkout and record platform limits.
- [x] 4.2 After verification, sync delta specs and update main-spec purpose and project status text for hosted Studio. Pass `npm run openspec:validate` and `npm run docs:check`.

# Spec Delta

## MODIFIED Requirements

### Requirement: Configured hosts select explicit scopes

The application SHALL use one shared catalog with an allowlisted host mapping. The apex host SHALL show the project presentation linking to Festivals as its example; the Festivals host SHALL serve the festival catalog. An unknown host SHALL expose no default catalog. Public absolute links SHALL use configured origins rather than arbitrary request host values. Scope hosts SHALL represent subjects rather than languages or countries.

#### Scenario: An unconfigured host requests the root

- **WHEN** the request host is outside configured origins
- **THEN** it does not reveal the festival catalog

#### Scenario: The configured apex host requests the root

- **WHEN** a visitor opens the configured apex root
- **THEN** the page shows the project presentation
- **AND** its festival example links to the configured Festivals origin

#### Scenario: The configured Festivals host requests the root

- **WHEN** a visitor opens the configured Festivals root
- **THEN** the page shows festival discovery rather than the project presentation

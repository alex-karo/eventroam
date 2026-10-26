# Spec Delta

## Purpose

Present the Eventroam data collection system to product teams and founders. Show its festival catalog example and offer a direct path to discuss data services or custom development with its author.

## ADDED Requirements

### Requirement: The presentation has three ordered sections

The apex homepage SHALL contain three main sections in this order: system presentation, festival catalog example, and cooperation options. It SHALL use short English copy with only a brief technical explanation. The page SHALL identify the project as Eventroam and present the system before its services.

#### Scenario: A visitor reads the homepage

- **WHEN** a visitor opens the apex root
- **THEN** the page presents a structured data catalog with agents to collect new records and update existing ones
- **AND** it shows three labeled steps: Source text, Structured record, and Data catalog
- **AND** the same fictional event appears in the source, record, and highlighted new catalog row
- **AND** an Agents label identifies the collection mechanism
- **AND** the festival example precedes the cooperation options
- **AND** the author statement stays within the cooperation section
- **AND** a direct contact action is also available in the introduction

### Requirement: The catalog is a clear and reachable example

The example section SHALL show a preview image of the festival catalog, describe its search, filters, and map, and state that the current demo uses fictional event data. "See an example" SHALL move to this section. "Explore the festival catalog" SHALL link to the configured Festivals origin.

#### Scenario: A visitor inspects the example

- **WHEN** a visitor follows "See an example"
- **THEN** the page moves to the festival example section
- **AND** the preview and fictional-data notice are visible in that section
- **AND** "Explore the festival catalog" points to the configured Festivals root

### Requirement: Both service options lead to the author

The cooperation section SHALL offer data delivery as "Get the data" and custom development as "Build your own system" for data beyond events. It SHALL state that the author built Eventroam. It SHALL invite visitors to describe their data needs and intended use. "Contact me on LinkedIn" SHALL link directly to the author's supplied profile. Neither option SHALL require an on-site form or account.

#### Scenario: A visitor wants to discuss a task

- **WHEN** a visitor reads either service option
- **THEN** the same section provides a direct contact action for both options
- **AND** the action links to `https://www.linkedin.com/in/alex-karo/`
- **AND** the page offers a personal discussion rather than an immediate purchase or subscription


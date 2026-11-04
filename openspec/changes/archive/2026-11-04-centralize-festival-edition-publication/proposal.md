# Proposal

## Why

Future event pipelines need to share Edition record checks and classification preparation. Today the record validator selects festival rules itself. Ingestion also mixes evidence checks with term normalization.

## What Changes

- Bind the field and facet requirements for each publication policy together. Use the festival policy in the current planner, writer, and fixture loader.
- List the rules for dates and coordinates in their validation order. Use code for conditions that compare fields.
- Give the catalog domain ownership of assignment limits and classification normalization. Let ingestion record the reason for each change.

## Capabilities

The [publication](../../../specs/catalog/publication/spec.md) and [classification](../../../specs/catalog/classification/spec.md) contracts apply.

## Impact

This change covers Edition records, proposal preparation, publication planning, and writes. A future pipeline can supply another policy when its publication requirements and storage scope are known.

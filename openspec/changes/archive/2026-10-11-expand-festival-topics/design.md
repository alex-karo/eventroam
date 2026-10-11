# Design

## Context

The taxonomy is curated database data, not a fixed enum of slugs. Publication checks in the writer and research preparation independently recognize eligible format slugs. Development and captured-page evaluation loaders provide their own terms. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Keep topic assignments independent of format and make both publication paths agree on openair. Supply the new terms to fresh development/eval catalogs and teach the researcher their boundaries.

**Non-Goals:** Schema changes, existing-data conversion, new UI controls, and real model/source calls.

## Decisions

Use flat topic terms with no automatic ancestry. Snow sports and surfing do not automatically assign outdoor activities. Keep dynamic IDs and database-driven public labels/filters; a fixed application enum would restrict curated additions unnecessarily.

Change both explicit format checks to openair. Do not accept the legacy format as an alias: the owner requested no migrations and selected an unambiguous new vocabulary. Leave historical SQL migration tests unchanged because they test old schema/data preservation.

Add definitions to the existing research prompt. Classification remains model-led and edition-specific; host validators enforce structure, not an invented activity threshold. The vocabulary document owns specific topic meanings and evidence boundaries; specs own facet structure, independence, and publication behavior.

## Risks / Trade-offs

- Existing catalogs containing format/outdoor no longer pass new publication operations → scope this change to fresh vocabulary; leave existing databases untouched as requested.
- Model classification may still be imperfect → document positive/negative evidence and retain source reasons; normal tests do not claim live-model accuracy.

## Migration Plan

No migrations, compatibility backfills, or existing catalog writes. Fresh fixture/eval catalogs use the new terms. Rollback is a matching code/vocabulary version; applying to an older populated catalog requires a separate owner-directed data update.

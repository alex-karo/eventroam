---
type: Known issue
title: Add can fail when Event slugs match
description: Two BIGSOUND requests generated the same slug and the second item failed to write.
status: draft
tags: [catalog, ingestion, publishing]
---

# Add can fail when Event slugs match

On 2026-11-21, the BIGSOUND Barakaldo request published an Event with the slug `bigsound-festival`. It added a Barakaldo 2026 Edition and a Torrent 2027 Edition. The next request in the same batch, BIGSOUND Valencia, also prepared a `createEvent` operation for `bigsound-festival`.

The Valencia attempt reported `write_failed`. It retained 11 proposed operations and zero receipts or catalog changes. The first operation used a slug that the catalog already held under a unique index. This is the likely cause. The report contains only the generic write error. [Event schema](../../src/db/schema.ts)

The attempt IDs are `b26eca14-7f64-4a06-be65-a782d6ee8694` for Barakaldo and `c204d519-6513-47ee-85e3-96db7a8b8d59` for Valencia. The current add flow derives the slug from the proposed Event name and fails the item on a collision. [Proposal validation and slug limits](../ingestion-process.md#validate-the-proposal)

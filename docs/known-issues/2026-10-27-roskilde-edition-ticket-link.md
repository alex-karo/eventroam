---
type: Known issue
title: Roskilde eval expects an unspecified ticket link preference
description: The eval rejects a direct Edition ticket link that the agent instructions allow.
status: draft
tags: [evals, ingestion, tickets]
---

# Roskilde eval expects an unspecified ticket link preference

On 2026-10-27, the Roskilde main eval failed because the agent set the Edition ticket link to the official [full-festival ticket](https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09). The [fixture](../../src/ingestion/evals/cases/roskilde/tickets.md) links to this offer for all eight days of the 2027 Edition. The [eval](../../src/ingestion/evals/main/roskilde.ts) accepts only the [ticket overview](https://www.roskilde-festival.dk/billetter).

The [Research instructions](../../src/ingestion/research/agent/prompt.ts) ask for an official booking URL for the selected Edition. They do not say to prefer an overview. The direct link meets those instructions, but the eval marks it wrong. The Edition was published with the direct link; its required facts passed.

The experiment ID was `7fa1e43a-4060-46b2-ba51-fc18f15f991a`; the Roskilde run ID was `5ae3c1b4-11dc-49ae-999d-f3a0c5281e2f`.

Status: unresolved. Decide whether the Edition ticket link should prefer an official overview for that Edition, with a direct offer as a fallback when no supported overview is available. If this rule is accepted, align the Research and Editor instructions, the relevant spec, and the eval. Links for individual ticket variants can still point to their own offers.

---
type: Known issue
title: Roskilde eval expects an unspecified ticket link preference
description: The eval now accepts the source-backed direct Edition ticket link and the ticket overview.
status: stable
tags: [evals, ingestion, tickets]
---

# Roskilde eval expects an unspecified ticket link preference

On 2026-10-27, the Roskilde main eval failed because the agent set the Edition ticket link to the official [full-festival ticket](https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09). The [fixture](../../src/ingestion/evals/cases/roskilde/tickets.md) links to this offer for all eight days of the 2027 Edition. The [eval](../../src/ingestion/evals/main/roskilde.ts) accepts only the [ticket overview](https://www.roskilde-festival.dk/billetter).

The [Research instructions](../../src/ingestion/research/agent/prompt.ts) ask for an official booking URL for the selected Edition. They do not say to prefer an overview. The direct link meets those instructions, but the eval marks it wrong. The Edition was published with the direct link; its required facts passed.

The experiment ID was `7fa1e43a-4060-46b2-ba51-fc18f15f991a`; the Roskilde run ID was `5ae3c1b4-11dc-49ae-999d-f3a0c5281e2f`.

Resolved on 2026-10-30. The eval now accepts both the ticket overview and the direct full-festival admission link. This follows the current Research instructions, which do not require an overview preference. The same correction adds the Instagram and Facebook URL forms present in the official page fixtures. URL matching remains exact apart from its existing normalization; other paths and queries do not pass because the host matches. Saved experiment results remain unchanged.

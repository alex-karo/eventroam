---
type: Known issue
title: Roskilde eval expects an unspecified ticket link preference
description: Archived after Links gained an explicit ticket overview rule and both repeated checks selected the required URL.
status: stable
tags: [evals, ingestion, tickets]
---

# Roskilde eval expects an unspecified ticket link preference

On 2026-10-27, the Roskilde main eval failed because the agent set the Edition ticket link to the official [full-festival ticket](https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09). The [fixture](../../../src/ingestion/evals/cases/roskilde/tickets.md) links to this offer for all eight days of the 2027 Edition. The [eval](../../../src/ingestion/evals/main/roskilde.ts) accepts only the [ticket overview](https://www.roskilde-festival.dk/billetter).

The Research instructions used for that run ask for an official booking URL for the selected Edition. They do not say to use the overview. The direct link meets those instructions, but the eval marks it wrong. The Edition was published with the direct link; its required facts passed.

The experiment ID was `7fa1e43a-4060-46b2-ba51-fc18f15f991a`; the Roskilde run ID was `5ae3c1b4-11dc-49ae-999d-f3a0c5281e2f`.

On 2026-10-30, the owner confirmed that only the ticket overview is correct for this Edition link. The temporary acceptance of the direct product link was removed from the eval. The source-backed Instagram and Facebook URL alternatives remain accepted. At that time, Research and Editor instructions did not state the overview rule, and individual ticket offers could retain their own product URLs.

The repeat experiment `84022c9e-f4de-4a71-8551-beffbf568186` passed with the wider ticket check. Its 5/5 result does not confirm this rule. Saved experiment results remain unchanged.

## Resolution, 2026-11-02

Archived at the owner's request. [Links instructions](../../../src/ingestion/roles/links/prompt.ts) now explicitly prefer an official ticket overview over product pages. Links selects public URLs independently of Tickets; individual offers no longer have URL fields.

Both Roskilde attempts in the final repeated measurement, experiment `f1baccce-8d59-45f2-be85-c948322ba512`, select the required overview URL. One attempt still fails a separate instalment-amount check; that failure does not concern the ticket link.

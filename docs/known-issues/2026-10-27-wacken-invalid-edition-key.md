---
type: Known issue
title: Invalid Edition key rejects Wacken research
description: A model-generated key failed validation and rejected the full research result.
status: draft
tags: [evals, ingestion, research]
---

# Invalid Edition key rejects Wacken research

On 2026-10-27, the Wacken main eval failed with `openai/gpt-6-luna`. Research found the 2027 dates and ticket prices, but returned `edition:wacken-open-air:2027` as `currentOrNextEdition.key`. [The research contract](../../src/ingestion/research/contracts.ts) allows up to 63 lowercase letters, digits, and hyphens, with no leading, trailing, or consecutive hyphens. The colons made this key invalid.

Validation reported `invalid_candidate` at `data.currentOrNextEdition.key`. It rejected the full research result, so the editor did not apply the supported facts and the new Edition was not created. The eval reported zero required and additional completeness for the new Edition. The saved Edition stayed unchanged.

The failing experiment ID was `7fa1e43a-4060-46b2-ba51-fc18f15f991a`; the Wacken run ID was `6a790645-db4a-4942-b44f-9dbb54df77d9`. This is one observed failure, not a measured failure rate.

Status: unresolved. Check whether the research instructions make the key format clear to the model. Consider a clear format instruction or safe handling of an invalid new key, while preserving stable existing keys and Edition identity. Verify any change against malformed keys and existing Edition matching.

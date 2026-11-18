# Proposal

## Why

The eval investigation found repeated Editor failures around absent optional fields. Editor sometimes approves a missing ticket URL or social link, although that path permits only a return. It can also omit a required decision. An invalid complete reply stops otherwise useful catalog changes.

An approved withdrawal can cause another error. Its explanation remains an open question and makes research partial, even when the assigned check is complete. Description checks can then compare a saved revision with the original proposal and report a false failure.

The requested result is a simpler Editor review with fewer invalid decisions and unnecessary returns. This proposal also changes completion reporting for approved withdrawals and corrects the related eval checks.

## What Changes

- Separate review of submitted changes and required targets from requests to supply a missing fact.
- Keep a return for a missing optional field only when source evidence supports a concrete correction.
- Treat an approved, explained withdrawal as a completed review action. Keep real research gaps open.
- Make source context sufficient for supported facts. A repeated field label is not required when the meaning is clear.
- Check the final reviewed descriptions and permit valid returns to live specialists in captured Editor evals.

This change covers Editor, completion reporting, and related evals. It does not change General's reply format, Event identity or Edition selection, Reader extraction, Classification generation, source collection, or model routing.

## Requirements

- Editor reviews every required target and submitted group once per review. An optional field with no proposal or prior return needs no approval or rejection.
- Editor can request a missing optional fact when the inspected evidence supports a specific correction and its specialist can still revise the group.
- An approved withdrawal preserves the saved value, or leaves a new value absent. The reason remains available to the operator without making otherwise complete research partial.
- An unfinished assigned check, source limitation, or unresolved group failure remains visible as incomplete research.
- Editor accepts a fact that clear source context supports for the correct Event, Edition, and field. Material errors and unsupported claims still need correction or withdrawal.
- Eval results assess the descriptions that finish review and distinguish a valid specialist correction from an invalid return.

## Acceptance criteria

- A run can finish with an optional ticket URL or social link that was never proposed or returned. Editor supplies no approval or rejection for that omission, and every required decision is present.
- Evidence of an exact missing ticket URL or another concrete missing fact can still lead to specialist correction and final review. An optional gap alone causes no return.
- A supported revision can finish review. An approved withdrawal keeps existing data unchanged, retains its reason, and permits success when all assigned checks are complete.
- An approved withdrawal does not hide an unfinished check or source limitation. A final group failure remains partial and contributes no rejected value to the catalog.
- A regular festival feature or festival address established by clear source context can pass review. An organiser office, unrelated programme, invented experience, or wrong-Edition fact still cannot supply that value.
- Description evals check the final catalog values. Missing required text or unsupported final content still fails. A rejected proposal cannot reach the catalog, and an approved revision cannot fall back to its disputed original.
- A captured Editor eval can complete an eligible live Location correction. A return to a fixed specialist without a live conversation still fails.
- A captured eval does not fail because a rejected item, Event, or Edition cancels a return. Rejected values remain outside the catalog.
- Existing identity, country, fixed-target, reference, return-limit, publication, cancellation, and transaction protections continue to pass their focused checks. Invalid complete Editor replies still prevent catalog writes.

## Impact

Operators receive fewer failed reviews and fewer false partial results. The work changes the internal Editor reply contract, report completion logic, and related eval checks. Existing report fields and catalog data need no migration. Historical reports remain unchanged.

The proposed contract and verification scope are in [design.md](design.md). Implementation work is in [tasks.md](tasks.md).

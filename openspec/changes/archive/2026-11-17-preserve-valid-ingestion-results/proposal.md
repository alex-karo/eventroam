# Proposal

## Why

Useful ingestion results can be lost at two steps. Editor can reject a whole field group before its specialist receives a clear correction. A later error in one returned group can stop the run and discard independent valid changes.

The classification audit found supported terms in groups rejected for an unsupported term. The repair audit found a corrected ticket link lost because unrelated social groups lacked valid omission reasons. Both cases need the same result: give the specialist a bounded chance to correct the group, then keep only changes that pass review and validation.

## What Changes

- Return disputed field proposals to their specialists while a return is available. A specialist can correct the proposal or withdraw it with a reason.
- Keep independent valid proposals when a returned group has a local error. Discard an unresolved proposal and its dependent changes.
- Keep final Editor review, existing return limits, publication rules, and write protections.
- Show unresolved group failures beside the changes that were accepted and saved.

This change covers field review and scoped group repairs. It does not add new classification clear actions, repair invalid Event or Edition identity, change required initial role output, or rerun historical jobs.

## Requirements

- A disputed field proposal receives a specialist return while its owner and return allowance are available. A supported proposal or an explained withdrawal can finish review without using every return.
- A local error in a returned group does not discard independent changes that pass all checks.
- An unresolved group supplies no new catalog value. Its saved value remains unchanged. A new target keeps that value absent.
- Only the assigned specialist supplies revised values. Editor approves each usable revision before catalog preparation, including a revision from the last allowed return.
- Existing identity, country, target, reference, dependency, publication, cancellation, and transaction protections remain in force.
- The operator can see which groups failed, why they failed, and which changes were saved. Unresolved repair work is reported as partial research.

## Acceptance criteria

- A classification with supported required terms and an unsupported optional term reaches its specialist. A corrected whole group can pass Editor review and retain the supported terms.
- A valid ticket-link correction can be saved while unrelated returned social groups remain unresolved. No rejected social proposal is saved.
- A local repair error for one specialist does not prevent another specialist's independent correction from reaching review and being saved.
- An unresolved returned proposal does not fall back to its disputed original proposal. Saved values remain unchanged, and absent values stay absent.
- A rejected temporal premise removes changes that depend on that Edition. Independent Event changes and changes for another accepted Edition can still be saved.
- A valid final revision can be accepted at the return limit. Repeated invalid group replies stop at the existing limit and leave that group rejected.
- Identity or country conflicts, changed fixed targets, unknown references, cancellation, and invalid complete Editor output still prevent catalog writes. Publication and transaction checks still reject invalid writes.
- A run that saves independent changes and drops an unresolved group records both results. Its research status is partial, and its catalog outcome describes the actual saved result. Preview produces the same decisions without catalog changes.

## Impact

The change affects ingestion field review, scoped repair handling, reports, and their tests. CLI and Studio retain their existing inputs and catalog outcomes. The catalog schema and stored data need no migration. Historical reports and jobs remain unchanged.

Implementation details and audit boundaries are in [design.md](design.md). Implementation steps are in [tasks.md](tasks.md).

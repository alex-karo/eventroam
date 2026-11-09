# Proposal

## Why

In a Roskilde evaluation, Editor found conflicting Smart Ticket instalment terms and rejected a ticket block that also contained a supported DKK 2,650 full pass. In a Wacken evaluation, Tickets returned an empty offer list with no free base price. The run stopped before Editor saw it, although the saved ticket page listed prices.

## What Changes

- Let Editor return an assigned proposal or omission. Keep all Editor comments in the decision notes. The group owner supplies any new value.
- Have Editor check each assigned group for unsupported claims and concrete gaps. Search relevant saved pages when the result can change a decision. Return an eligible group with the source excerpt when it supports a correction or fills a gap.
- After the item checks pass, return assigned groups with field errors before review. In each round, send one request per owner with all eligible groups. A group can return up to three times. Validation can use one return before review. A revision can change only the requested groups.
- Review the complete result before preparing catalog operations. Show the original proposal, the reason for repair, and the outcome in the private report.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-updates`
  - **Before** — Each change needs a supported proposal for the selected target and field group.
  - **After** — The assigned owner supplies any replacement, including a value for a returned omission. Each final group must pass its usual checks.
- `catalog/ingestion-workflow`
  - **Before** — An invalid required proposal can stop the item before review.
  - **After** — Validation can return any invalid assigned group that it can identify after the item checks pass. The workflow groups returns by owner in each round. After each editorial return, Editor reviews only the returned groups.
- `catalog/source-access`
  - **Before** — Editor can inspect uncited saved pages to validate a proposal. The spec forbids replacement values from this access.
  - **After** — Editor can share passages in its note. The group owner can bind new passages from saved pages to support a revision.
- `catalog/classification`
  - **Before** — The spec assigns count conflicts to Editor. Assembly currently stops on these conflicts before review.
  - **After** — Classification receives the count error and can submit a valid complete list or leave classification unresolved.
- `catalog/location-resolution`
  - **Before** — Location supplies the complete place decision. Editor approves or rejects it.
  - **After** — Editor can also return the place group to Location with its notes. Location makes all place corrections, including spelling changes.
- `catalog/ingestion-runs`
  - **Before** — The private report shows findings, changes and failures. The CLI identifies the saved report by run ID.
  - **After** — The report also shows each return, who requested it, the revision and its source support, and the final decision.

## Impact

This affects proposal validation, Editor and specialist roles, the workflow that runs in Studio, private reports, and ingestion evaluations. CLI and Studio use the same workflow. The writer receives one validated plan for each Event.

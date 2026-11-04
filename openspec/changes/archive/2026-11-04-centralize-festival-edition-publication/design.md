# Design

## Change size

Medium. Ingestion and catalog writes share record and assignment rules. Each caller still owns its decision about what to do when a check fails.

## Rule selection

Bind the required fields and facet groups in one typed publication policy. Expose three operations from that policy: validate a complete Edition record, check assigned facets, and test publication eligibility. The eligibility test runs both checks for the published state. A field update uses the full record check. A term replacement checks the proposed facets before it changes the assignments. The current catalog uses the festival policy at each entry point. Another policy can use the same operations when its rules are available.

## Record checks

Parse scalar values and defaults with the existing schemas. Evaluate each date and coordinate condition in declaration order with its current error message. Apply coordinate ranges, required publication fields, and the complete price check in that order. Keep date and coordinate checks common to all policies.

## Classification

Ingestion checks source evidence and the reuse decision. The domain resolves proposed IDs, rejects unknown and duplicate terms, applies facet limits, and removes selected ancestors. Return retained and removed IDs in their current order. Ingestion uses these results to build the proposal and its explanation for the Editor.

Direct writes validate requested assignments against the full taxonomy inside the transaction. A selected ancestor rejects the operation. The writer also rejects missing parents and cycles. Proposal normalization stops when the parent is missing or repeats. Keep these traversal rules separate.

## Execution paths

| Path | Input and result |
| --- | --- |
| Prepare a proposal | Evidence and proposed IDs produce an ordered set of terms and a reason for the Editor. |
| Plan publication | Combine saved and proposed values and terms. Add a publish operation when the complete Edition passes the selected policy. |
| Publish | Validate the stored row and assigned facets in the transaction. |
| Edit a published Edition | Validate the merged row or the proposed assignments before the write. |
| Load fixtures | Use the same record and strict assignment checks with the fixture transaction. |

The existing workflow owns research, Editor decisions, and republishing. The writer owns transactions, audit history, and receipts. The work adds no scope selector or database migration.

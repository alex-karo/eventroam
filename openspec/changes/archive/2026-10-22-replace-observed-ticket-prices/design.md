# Design

## Change size

Small. The ticket data shape and writer already support atomic replacement. The behavior change is in model instructions and evaluation expectations; it changes how a partially observed block is interpreted.

## Approach

Research includes the ticket offers with supported prices found during the current check, even if another category or checkout remains inaccessible. The finding's variants and basePrice are the entire proposed new block. It does not merge saved variants, infer availability, or claim a complete survey of all offers. The editor accepts that block when its facts are supported and belong to the selected Edition. Existing preparation converts basePrice to minor units and the writer replaces the stored block atomically.

Without a supported price, research omits tickets, so the existing omission behavior preserves the saved block. Source failures and closure-only notices do not automatically clear prices. Research can still report incomplete checks and partial status independently of the price replacement.

## Risks and validation

An unverified saved category disappears when a supported price replaces the block. This is intentional and is asserted in the updated partial-ticket eval for Regular EUR 110 / blocked Student checkout. The eval also requires the new base price and retained partial/unresolved diagnostics. Existing tests cover structural money validation, unknown currency, and atomic writer replacement. No new matching or completeness validator is needed.

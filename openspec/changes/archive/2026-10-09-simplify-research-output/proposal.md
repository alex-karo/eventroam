# Proposal

## Why

Research currently lacks an explicit completion status, mixes errors with unknown facts, and cannot explain corrections. Generic claims and owned links make the response unnecessarily complex.

## What Changes

- Define success by completed research, including incomplete announcements; partial requires a specific unfinished core check and cause.
- Expose safe structured host diagnostics for model failures in CLI and eval reports; keep retries disabled.
- Default eval, research, and discovery requests to Flex, with an explicit standard-routing override.

- **BREAKING:** Make `add` create-only: an existing match returns `skipped` and its ID without writes; updates require `refresh/check`.
- **BREAKING:** Return `{ status, data, errors, unresolved }`; separate research completion from write outcome.
- **BREAKING:** Replace claims with explained, typed edition fields; group dates and coordinates, use `tickets.value.{variants, basePrice}` and classification add/remove patches.
- Keep only `scheduleStatus`; omit timezone and edition-wide ticket availability. Preserve saved zones; collect and display availability per ticket variant, removing edition-wide availability from public payloads and badges.
- Require reasons for facts and Event creation. Keep existing names unchanged; log differing model eventName values for later review. Describe inspected pages once in shared `sources`, without fact-to-page references.
- **BREAKING:** Return one Event website, platform-keyed socials (including X/Twitter), and one ticket URL per edition. No separate classifier; supplied slots replace their owner/kind links, omitted slots preserve them.
- Exclude eligibility-based concessions from basePrice while retaining them in ticket variants.
- Use major currency units throughout model prices with validated three-letter ISO currency codes; convert base-price amounts at the adapter boundary.
- Update prompt, reports, CLI, public readers/views, and evals together. Retain atomic writes, omission-preserves semantics, complete ticket replacement, and model-led interpretation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Research contract, monetary units, link replacement, and attributable reports.
- `catalog/publication`: Category-specific availability on public details.
- `website/discovery`: No edition-wide sales badges or map indicators.

## Impact

Affects research schema/agent/adapter, workflow/reporting, CLI/evals, link vocabulary/labels, public catalog/discovery readers and views, and documentation. Private reports move to version 2. Backward compatibility with old contracts, report readers, or old-code rollback is not required. No new service, database migration, public layout redesign, citation verifier, or durable audit extension.

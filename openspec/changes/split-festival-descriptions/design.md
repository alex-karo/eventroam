# Design

## Change size

Medium. Two Event fields replace one across storage, ingestion and public pages. Generation moves to Classification. Ingestion also checks whether the run has an Edition before it starts specialists.

## Approach

General establishes identity and selects Edition targets. It keeps dates, status and attendance work. Remove description generation, its description check and the `event` result object, which currently contains only `summary`. Keep the year and qualifications for attendance in the reason for `sizeEstimate`.

On add and full refresh, Classification writes both texts and runs one description check in its existing call. Give it the programme and description evidence, saved descriptions and relevant place evidence. Limit General's input to the evidence and saved fields it still needs.

Use the [description rules](proposal.md#requirements) for current format and announced changes. Keep the existing rules for reusing Edition categories.

Classification instructions exclude Edition dates, lineups, prices, directions, attendance counts, invented amenities, sales claims, keyword lists, and unsupported service promises. A brief supported format is sufficient; indirect detail must not mislead. Direct setting evidence takes priority over an `Open Air` name.

Classification returns one festival text pair and separate category results for the selected Editions. Give it instructions about the text and leave storage ownership to the application. The application maps the texts to Event fields and the categories to Edition fields. Editor uses its existing review to accept or reject each text proposal independently. An omitted field keeps its stored value.

Run Location and Classification in parallel. Location uses its own source evidence and the saved detailed description when available.

## Edition evidence

When the workflow handles the General result, check for a selected Edition or a saved Edition with `scheduled` or `announced` status. An explicit announcement can still be selected without complete dates. Use the same point in the workflow for both early exits, before specialists run.

- If neither condition holds, end the run and record “Insufficient information about editions” in the existing report diagnostics.
- If `current` has a qualifying saved Edition and no current or next target, report the existing `unchanged` outcome.

Early exits preserve General's unfinished checks and unresolved questions. The `unchanged` outcome describes catalog writes only. It does not imply `researchStatus: success`. An unresolved target selection keeps `researchStatus: partial`.

Keep the duplicate-add skip. On add and full refresh, assign the description check when the Edition gate passes. Full refresh can pass through a saved Edition with empty target slots. Assign category work only to selected Editions.

Use the [existing refresh selection rules](../../../docs/ingestion-process.md#choose-the-refresh-target). Add can create the Event and both selected Editions atomically; duplicate add remains an identity-only skip. Full checks shared links and both Edition slots, excluding historical tickets. Other saved Editions are context, not write targets. Do not require extra unsaved history or impose a twenty-Edition cap on saved context; retain real context and deadline limits and unfinished mandatory checks.

For current scope, keep `previousEdition` null and reject Event or unselected-Edition findings before writes. Retain country, ownership, and identity guards. Size, precise coordinates, and detailed address stay optional. A changed venue or programme alone does not require full refresh; ongoing tickets stay in scope. An empty selected slot starts no historical ticket work.

## Contracts

Rename the stored Event summary to `description` and add nullable `shortDescription`. Preserve old summaries and leave the short field empty during migration. Either field can be absent. Reuse the audit and clear operations.

Classification proposes a set or clear independently for each description. In current scope, omit description instructions, the check and both fields from its output schema. Validate scope again after specialist results are joined, since the existing General guard runs before Classification. Reject prohibited Event proposals before catalog operations.

## Display

| Stored text | Event page and About the festival | Text for search and social descriptions |
| --- | --- | --- |
| Both | Detailed | Short |
| Detailed only | Detailed | Detailed |
| Short only | Short | Short |
| Neither | Automatic | Automatic for Event. Public place for Edition. |

Treat null, empty and whitespace-only text as absent for display. Generate one name-based sentence at render time when a page needs automatic text. For example, “River Lights is a festival listed in the Eventroam catalog.” This needs no model call or write. Eligible Edition structured data uses the same text as its About section.

Use the same description for search, Open Graph and Twitter. On Event pages, add the public name only when the text does not already start with it. On Edition pages, put the display name, year, status and date range before the festival text. This keeps date qualifications visible if the preview is cut short.

Historical Edition pages also show the current text under About the festival. Do not store historical description versions.

Reuse the current [public read contract](../../../src/catalog/read/contracts.ts) and [metadata rules](../../../src/site/server/metadata.ts). Keep nullable coordinates and stored precision, private-evidence exclusion, stable identities and Edition keys, qualified date ranges, and official links. Event pages retain festival text and public Edition history without an active Edition detail block, tickets, or map. Edition pages retain their own facts, shared navigation labels, and discovery context. History links work without a map, include cancelled and postponed Editions, distinguish same-year entries, sort newest first with stable identity ties, and mark the current Edition.

Preserve clean canonical and social identities for both roots, public-page indexing, and sitemap eligibility. Use the stored year even when it differs from the Edition key. Keep tentative and previous dates and cancellation/postponement status visible. Emit no preview image. Edition Event JSON-LD needs confirmed dates and a country with street address or locality. Use date-only values and the clean identity URL; invent no times, images, organizers, performers, or offers. Provisional dates or insufficient location omit JSON-LD without changing indexing. History and discovery lists are not one dated Event.

## Main eval

Main eval sends one reference sentence and both available stored texts to PPLX Decider in one request. Each text has its own yes or no question. Save the returned probabilities with the case output and print them beside the Editor decisions.

Count each numeric result as one required fact. Use the raw probability and count a result below 0.80 as missing. Skip fields without a numeric result.

Report missing text, absent references, and unavailable decisions separately. One passing and one below-threshold text count as one correct and one missing required fact, without adding a factual error for the low score.

## Isolated Classification eval

Reuse the River Festival announcement and saved Edition from the current-scope regression. Supply the announced Edition as a fixed target and run Classification in full scope. Seed both saved texts with the former format. Bind the announcement quotation before any model call.

Check the proposed categories and both replacement texts directly. Use the same Decider request and threshold as main. In this case, both texts and both numeric scores are required. Store the direct execution and checks in a separate experiment.

Register `regression/classification` in `--all`, but exclude it from the default group. Keep expected answers out of production input. Match expected category IDs without extra or duplicate IDs, check both sentence counts, and fail a missing or unavailable text assessment. Save direct results before Editor review or catalog writes. See the [eval guide](../../../docs/ingestion-evals.md#isolated-classification-cases).

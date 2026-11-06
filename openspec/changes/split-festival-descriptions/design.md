# Design

## Change size

Medium. Two Event fields replace one across storage, ingestion and public pages. Generation moves to Classification. Ingestion also checks whether the run has an Edition before it starts specialists.

## Approach

General establishes identity and selects Edition targets. It keeps dates, status and attendance work. Remove description generation, its description check and the `event` result object, which currently contains only `summary`. Keep the year and qualifications for attendance in the reason for `sizeEstimate`.

On add and full refresh, Classification writes both texts and runs one description check in its existing call. Give it the programme and description evidence, saved descriptions and relevant place evidence. Limit General's input to the evidence and saved fields it still needs.

Use the [description rules](specs/catalog/ingestion-workflow/spec.md#requirement-festival-descriptions-keep-their-event-scope) for current format and announced changes. Keep the existing rules for reusing Edition categories.

Classification returns one festival text pair and separate category results for the selected Editions. Give it instructions about the text and leave storage ownership to the application. The application maps the texts to Event fields and the categories to Edition fields. Editor uses its existing review to accept or reject each text proposal independently. An omitted field keeps its stored value.

Run Location and Classification in parallel. Location uses its own source evidence and the saved detailed description when available.

## Edition evidence

When the workflow handles the General result, check for a selected Edition or a saved Edition with `scheduled` or `announced` status. An explicit announcement can still be selected without complete dates. Use the same point in the workflow for both early exits, before specialists run.

- If neither condition holds, end the run and record “Insufficient information about editions” in the existing report diagnostics.
- If `current` has a qualifying saved Edition and no current or next target, report the existing `unchanged` outcome.

Early exits preserve General's unfinished checks and unresolved questions. The `unchanged` outcome describes catalog writes only. It does not imply `researchStatus: success`. An unresolved target selection keeps `researchStatus: partial`.

Keep the duplicate-add skip. On add and full refresh, assign the description check when the Edition gate passes. Full refresh can pass through a saved Edition with empty target slots. Assign category work only to selected Editions.

## Contracts

Rename the stored Event summary to `description` and add nullable `shortDescription`. Preserve old summaries and leave the short field empty during migration. Either field can be absent. Reuse the audit and clear operations.

Classification proposes a set or clear independently for each description. In current scope, omit description instructions, the check and both fields from its output schema. Validate scope again after specialist results are joined, since the existing General guard runs before Classification. Reject prohibited Event proposals before catalog operations.

## Display

| Stored text | Event page and About the festival | Event meta, Open Graph and Twitter |
| --- | --- | --- |
| Both | Detailed | Short |
| Detailed only | Detailed | Detailed |
| Short only | Short | Short |
| Neither | Automatic | Automatic |

Treat null, empty and whitespace-only text as absent for display. Use one name-based sentence at render time. For example, “River Lights is a festival listed in the Eventroam catalog.” All detail pages have a public Event name. This needs no model call or write. Eligible Edition structured data uses the same text as its About section. Edition metadata uses the existing occurrence-specific template.

Historical Edition pages also show the current text under About the festival. Do not store historical description versions.

## Main eval

Main eval sends one reference sentence and both available stored texts to PPLX Decider in one request. Each text has its own yes or no question. Save the returned probabilities with the case output and print them beside the Editor decisions.

Count each numeric result as one required fact. Use the raw probability and count a result below 0.80 as missing. Skip fields without a numeric result.

## Isolated Classification eval

Reuse the River Festival announcement and saved Edition from the current-scope regression. Supply the announced Edition as a fixed target and run Classification in full scope. Seed both saved texts with the former format. Bind the announcement quotation before any model call.

Check the proposed categories and both replacement texts directly. Use the same Decider request and threshold as main. In this case, both texts and both numeric scores are required. Store the direct execution and checks in a separate experiment.

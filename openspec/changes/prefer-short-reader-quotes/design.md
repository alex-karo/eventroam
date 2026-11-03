# Design

## Change size

Small. Reader, Links, Tickets and Location prompt wording and versions change. Existing output types and literal binding remain in use. The main uncertainty is model compliance and token cost.

## Approach

Reader will prefer a full literal string for a short address, paragraph, or small factual block, even when it has several lines or Markdown escapes. It will keep the object label, year and conditions. Separate office and festival blocks keep their own labels. Long passages can still use unique start/end references.

The existing binding code checks the result. No repair call, new tool, length threshold, or parsing heuristic is added. The prompt version advances so traces distinguish the experiment.

## Examples experiment

Add brief fictional input/output examples to the role that owns each decision. Reader examples distinguish a date correction from an explicit nonpublication statement and retain adjacent metadata claims for different years. Links selects the supplied verified final URL when repairing an unofficial saved website. Tickets retains eligibility conditions and leaves a concession unresolved when its year is unclear. Location distinguishes a place name in the Event title from a source invitation to attend that Edition in the locality. Examples show only the relevant output fields or decisions, not a second full output contract.

Do not add examples with eval names, dates, URLs or expected values. Do not change Editor, fixtures, scorers, quote binding, deduplication or discovery. Existing source-access, ingestion-updates and location-resolution requirements already cover these decisions; no further domain requirement is needed.

Compare this combined prompt experiment with the completed short-quotation run, using the same main and isolated Reader groups and two attempts per case. This comparison tests the combined change, not the separate effect of each example. Keep the baseline databases unchanged. Inspect new failures, website and locality recovery, ticket eligibility, coverage and duplicated evidence as well as aggregate scores and native token costs.

## Risks and validation

Full strings can cost more output tokens or contain copying errors. Run main and isolated Reader eval groups twice per case before and after the change with `opencode-go/gpt-6-luna`. Compare field completeness, Reader recall, literal binding, input/cache/output tokens and available native cost. OpenCode does not expose the OpenRouter standard/flex setting; both runs use the same OpenCode settings. Missing monetary cost remains unknown.

Use the unchanged dataset and source fixtures. Inspect Roskilde address blocks, the Wacken ticket passage and Glastonbury history in the saved evidence. Sziget discovery remains outside this change. Run existing evidence tests and focused static checks. Store experiment results in the native eval databases.

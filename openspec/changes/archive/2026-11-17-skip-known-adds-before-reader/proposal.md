# Proposal

## Why

An `add` run collects source evidence before General can identify a duplicate. A repeat request can therefore use source reads and model calls even when its note identifies a saved Event.

The user requested a simple check before Reader. Search starts with the Event name or alias. Country and URL are optional extra signals. For example, `example fest, us` can match a saved US Event without a URL. This rule trusts the request and saved catalog. It does not confirm identity from a fresh source.

## What Changes

- Find candidates by saved Event name or alias before source collection. Use a supplied country or URL to resolve the match.
- Return an early `skipped` result for one Event supported by name and country, or by name and full official URL. Continue ordinary research for other notes.
- Show the basis of the early skip in the saved report.
- Keep the current add input and use the same check for CLI, Studio, and queued jobs.

This change covers repeat requests only. It does not fix the large General input for new Events. Candidate search for General and changes to refresh are outside this proposal.

## Requirements

- An add note returns early `skipped` with the existing Event ID when its complete name or alias and a known country identify one Event without a conflict. A URL is optional.
- A complete name or alias and a full official URL can identify the Event when country is absent or unknown. A known country conflict prevents an early skip.
- A name alone, a shared hostname, or an unresolved match continues ordinary research. Missing country data does not exclude a candidate or establish that an Event is new.
- An early skip changes no catalog facts and completes successfully in both preview and apply.
- The saved report identifies a match from the request and catalog. It does not present that match as identity confirmed by source evidence.

## Acceptance criteria

- `example fest, us` returns early `skipped` for one matching US Event, including a match through an alias. Source, search, and model-call counts are zero. Catalog facts stay unchanged.
- A saved `https://example.com/` and supplied `https://example.com/en/index` do not prevent an otherwise unique name-and-country match. Without country support, a shared hostname alone cannot cause an early skip.
- A complete name or alias and a full official URL can return early `skipped` without a known country. A name alone, country alone, URL alone, or name fragment continues ordinary research.
- A known country conflict, conflicting name and URL signals, or unresolved candidate ambiguity continues ordinary research. An unknown country keeps a candidate in consideration. The complete original note reaches collection unchanged.
- An early skip has a completed durable attempt and a successful CLI or job result. Its report shows the match basis, empty source evidence, and no proposed or applied operations.

## Impact

The change affects the ingestion workflow, a private catalog read, report construction, catalog chat report consumers, and their tests. The input contract and catalog storage schema stay the same.

The early skip is an exception to the current rule that add text is only search leads. An incorrect name, country, or saved official link can cause a wrong skip. Different Events can also share a name and country. The run writes no new facts, but the requested new Event can be missed. Requests that continue to research keep the current source evidence rules in the [ingestion process](../../../../docs/ingestion-process.md) and [ingestion tools](../../../../docs/ingestion-tools.md).

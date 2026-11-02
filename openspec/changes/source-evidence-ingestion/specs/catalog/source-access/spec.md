## MODIFIED Requirements

### Requirement: Public pages are read within safety bounds

Source access SHALL use bounded public HTTP(S) requests and block non-public destinations, including redirects, before connecting. Direct reads SHALL NOT execute page scripts locally. Read records SHALL retain requested/final URLs, retrieval time, method, status, and available content. Full extracted content within retrieval bounds SHALL remain available for later validation.

#### Scenario: A readable public page
- **WHEN** a public page contains festival facts and links in its response
- **THEN** the reader returns the available facts and links in Markdown without executing its scripts

#### Scenario: An unsafe destination
- **WHEN** a requested URL or redirect resolves to a non-public destination
- **THEN** the reader blocks that request before connecting to the destination
- **AND** the model receives `status: failed` with a reason code

### Requirement: Source summaries identify useful inspected evidence

Ingestion SHALL retain a general content description for each informative inspected page, including known limits. It SHALL distinguish inspected sources from unread leads. A partial page can support a fact while omitted content remains unverified. Descriptions alone SHALL NOT establish facts. Source descriptions SHALL remain available for no-op and failed-write outcomes.

#### Scenario: One page supports several facts
- **WHEN** an inspected page supports dates and venue for one Edition
- **THEN** its description can mention both topics and the same source passage can support several fields without presenting them as separate sources

#### Scenario: A destination was not read
- **WHEN** research finds a URL but does not inspect it
- **THEN** ingestion keeps that URL as an unread lead rather than an inspected source

#### Scenario: A description omits a condition
- **WHEN** a page overview mentions a price but omits its eligibility condition
- **THEN** the description alone cannot support a ticket change
- **AND** the change needs applicable source evidence and its qualifications

#### Scenario: An inspected page states that a detail is not published

- **WHEN** an inspected page explicitly says that a detail is unavailable or not yet announced
- **THEN** collection can retain that page-local statement separately from extraction problems
- **AND** a page that is silent or unprocessed does not establish the detail's absence
- **AND** the coverage description alone does not authorize a catalog change

### Requirement: Page reads use a small model response

A source-read result SHALL identify its destination, retrieval status, known limitations, and remaining allowance. Retrieval statuses SHALL remain ok, unsupported, or failed, separate from ingestion completion. Success SHALL NOT certify complete retrieval or complete factual checking.

#### Scenario: A supported response is received
- **WHEN** retrieval returns a supported successful response
- **THEN** `status` is `ok`, even if extracted text is empty or limited
- **AND** `reasonCode` can identify a known content limit such as `javascript_required`
- **AND** the result reports extraction coverage separately from retrieval success without claiming complete factual checking

#### Scenario: A source or format is unsupported
- **WHEN** the reader does not support the source or response format
- **THEN** `status` is `unsupported` and `reasonCode` identifies the limitation

#### Scenario: A read fails or is blocked
- **WHEN** a request fails, is blocked, or cannot start within the budget
- **THEN** `status` is `failed` and `reasonCode` identifies the cause
- **AND** the status is neither `blocked` nor `partial`

### Requirement: Map limitations preserve page evidence

Readable page content SHALL remain available when a map fails, is blocked, has an unsupported format, or exceeds a bound. The saved Markdown SHALL retain the affected map and limitation while preserving the parent page status. Combined page and map text SHALL remain subject to the shared retrieval and processing bounds. Unread map data SHALL NOT be reported as absent.

#### Scenario: Google data cannot be parsed
- **WHEN** the map response has an unsupported or malformed data structure
- **THEN** the result retains page content and the map reference with an explicit limitation
- **AND** it does not report that the map has no markers

#### Scenario: An internal request is unsafe or exhausts the budget
- **WHEN** a map request is blocked by source safety checks or cannot complete within the budget
- **THEN** the result retains available page evidence and marks map retrieval incomplete

#### Scenario: Combined text exceeds the Markdown limit
- **WHEN** page text followed by map blocks exceeds the existing limit
- **THEN** saved text retains the combined content and identifies any part that could not be processed

## ADDED Requirements

### Requirement: Saved sources support later validation

Each run SHALL save full parsed Markdown and provenance as private artifacts within retrieval bounds. Provenance SHALL identify URLs, retrieval time, method, limits, and content identity. Website metadata SHALL remain source claims. Saved evidence SHALL be inspectable after exit without a new fetch. Missing required storage SHALL stop dependent changes.

#### Scenario: A later check needs the original page

- **WHEN** a proposed change needs source validation
- **THEN** the saved text and its provenance are available without another network request
- **AND** body and metadata claims remain distinguishable

#### Scenario: Source storage fails

- **WHEN** a source needed by a change cannot be saved
- **THEN** no item changes are applied and a safe storage diagnostic is retained

#### Scenario: Workflow history is removed

- **WHEN** the owner deletes only workflow history
- **THEN** the saved source artifacts remain until explicit cleanup

### Requirement: Source support retains context and identity

A source-based change SHALL retain enough source context to identify its meaning and applicable Event or Edition. A matching quote SHALL NOT prove factual support by itself. Missing, ambiguous, or unrelated source references SHALL NOT authorize a change. The same source passage can support more than one field.

#### Scenario: The same passage supports two fields

- **WHEN** one passage establishes a venue and supports the Event description
- **THEN** both changes can use the same source passage without treating it as independent sources

#### Scenario: A quotation is ambiguous

- **WHEN** a reference cannot identify which repeated passage supports the claim
- **THEN** it is not accepted as attributable support and the limitation remains visible

#### Scenario: A quotation concerns another year

- **WHEN** a quote exists but concerns another Edition
- **THEN** it does not support changing the selected Edition

#### Scenario: A page description omits a condition

- **WHEN** a page description leaves out an eligibility condition or table qualification
- **THEN** a ticket change must still respect the original source condition

#### Scenario: A compact reference identifies a long passage

- **WHEN** extraction identifies a passage by its unique literal opening and closing text
- **THEN** saved support retains the complete original passage and its required context
- **AND** ambiguous, reversed, overlapping, or unmatched boundaries do not authorize a change

#### Scenario: A processing input omits empty metadata

- **WHEN** a downstream input omits empty context or optional metadata
- **THEN** all nonempty qualifications and the complete supporting passage remain available
- **AND** saved source provenance remains inspectable

#### Scenario: A saved-source search has no complete match

- **WHEN** validation searches saved source text and receives no matches or shortened matching lines
- **THEN** that result alone does not establish that a fact or qualification is absent
- **AND** a proposed change still needs applicable source support

### Requirement: Saved source text survives partial processing

Ingestion SHALL retain full extracted Markdown within retrieval bounds. Partial processing SHALL NOT shorten that saved text. Unprocessed content SHALL remain unverified. Repeated inspection of a requested or final URL SHALL reuse its available read result, including failures, within the run.

#### Scenario: A long page cannot be fully processed

- **WHEN** a retrieved page exceeds the available processing allowance
- **THEN** its saved text remains intact
- **AND** the run identifies the unprocessed portion without claiming that missing topics are absent

#### Scenario: An initial source is large

- **WHEN** an initially inspected source exceeds the processing allowance
- **THEN** the same source preservation and limitation rules apply

#### Scenario: A cached URL is inspected again

- **WHEN** a later request matches the requested or final URL of an available read
- **THEN** the run reuses that source without another network request
- **AND** the result reflects the current remaining allowance

## REMOVED Requirements

### Requirement: Cached Markdown is cut only for model input

**Reason**: Processing limits no longer use a truncated Markdown prefix. The complete source is saved for later validation.

**Migration**: Use "Saved source text survives partial processing" for full-text retention and explicit processing limits.

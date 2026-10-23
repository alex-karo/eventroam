# Source access

## Purpose

Define safe, bounded access to public evidence and the meaning of incomplete or uninspected source results.

## Requirements

### Requirement: Public pages are read within safety bounds
The source reader SHALL use bounded requests for public HTTP(S) destinations and SHALL block non-public destinations, including redirects to them, before connecting. Direct reads SHALL NOT execute page scripts locally. A source result SHALL identify its URL, retrieval time, outcome, and available extracted content.

#### Scenario: A readable public page
- **WHEN** a public page contains festival facts and links in its response
- **THEN** the reader returns the available facts and links without executing its scripts

#### Scenario: An unsafe destination
- **WHEN** a requested URL or redirect resolves to a non-public destination
- **THEN** the reader blocks that request before connecting to the destination

### Requirement: HTML table extraction preserves row relationships
The source reader SHALL keep the factual text and links from each HTML table row together in the extracted result. It SHALL omit HTML select controls and their option text.

#### Scenario: A cell contains a line break
- **WHEN** a table cell places a note after an HTML line break
- **THEN** the extracted text keeps the note with the other cells in that row

#### Scenario: A selection control appears in a table
- **WHEN** a table row contains a select control with several options
- **THEN** the extracted text omits the control and option text while retaining the other cells

#### Scenario: A selection control appears outside a table
- **WHEN** a page contains a select control outside a table
- **THEN** the extracted text omits the control and option text

### Requirement: Incomplete pages remain explicitly partial
If direct retrieval cannot check an assigned fact, any configured alternate retrieval SHALL stay within the shared source bounds. The result SHALL identify the retrieval method and retain readable content from either method. If neither method can check the assigned fact, the result SHALL remain partial and SHALL NOT report the missing fact as absent.

#### Scenario: Alternate retrieval returns evidence
- **WHEN** an eligible page returns content relevant to an assigned check through configured alternate retrieval
- **THEN** the result returns that bounded content and identifies the retrieval method

#### Scenario: Alternate retrieval cannot complete the check
- **WHEN** alternate retrieval cannot run, fails, or returns no evidence for the assigned check
- **THEN** the result retains any content from direct retrieval and marks the check partial
- **AND** missing facts remain unverified

#### Scenario: A direct request is blocked by the site
- **WHEN** a public site blocks direct retrieval and alternate retrieval is configured within the budget
- **THEN** the source result reflects the bounded attempt and its outcome

### Requirement: Research stays within a shared run budget
Source reads, discovery, and model work SHALL share a bounded run budget. The system SHALL allow relevant follow-up pages while time remains without an independent fixed page-count or link-depth cap. At a hard limit without a usable result, it SHALL retain the limit reason, known usage, source-read history, and available model questions. It SHALL NOT require or invent a complete list of unfinished checks. A budget limit SHALL NOT turn an unread source into a verified absence.

#### Scenario: A relevant linked page remains available
- **WHEN** a source links to a more specific ticket or announcement page and budget remains
- **THEN** research may inspect that page before returning findings

#### Scenario: The budget expires
- **WHEN** the budget expires before a usable final result
- **THEN** the run reports the limit with available diagnostics and makes no catalog changes
- **AND** no complete list of unfinished checks is required

### Requirement: Oversized assignments fail without losing targets
An assignment that exceeds supported size SHALL fail explicitly before research when detectable, otherwise before application. The report SHALL retain the full assignment and a size diagnostic. Ingestion SHALL not silently truncate targets or split the assignment into separate runs.

#### Scenario: Saved history exceeds the supported assignment size
- **WHEN** a full refresh assignment cannot fit supported limits
- **THEN** the run fails with the complete target list and size reason instead of researching an incomplete subset

### Requirement: Discovery results are leads until inspected
Discovery SHALL return bounded, unique, valid HTTP(S) candidates with titles and available short highlights. Highlights and result ordering MAY help choose what to inspect; they SHALL NOT establish catalog facts or a replacement official website until the destination is inspected.

#### Scenario: A result claims an announcement
- **WHEN** a search highlight appears to announce an Edition
- **THEN** research inspects the destination before using its dates or claiming a verified official source

#### Scenario: Results contain invalid or repeated URLs
- **WHEN** results include malformed, non-HTTP(S), or duplicate URLs
- **THEN** those candidates are excluded without hiding later valid candidates within the result bound

### Requirement: Discovery is limited to material source needs
Discovery SHALL be bounded to finding an unknown official source or resolving an inaccessible or wrong source or a material identity or date conflict. Missing optional fields or an unannounced next Edition alone SHALL NOT justify another search. A discovered result SHALL not support catalog facts until inspected.

#### Scenario: Official sources contain no next announcement
- **WHEN** relevant accessible official sources have been checked without finding a next announcement
- **THEN** research reports that finding for the inspected sources without searching solely for the missing announcement

#### Scenario: A known source conflicts with Event identity
- **WHEN** relevant known links cannot resolve a material identity or date conflict
- **THEN** research may discover and inspect a candidate source within the budget

### Requirement: Source summaries identify useful inspected evidence
The research model SHALL summarize inspected sources that informed findings and SHALL distinguish them from unread leads. A useful partial page MAY support a fact while its missing information remains unverified. The application SHALL retain model summaries without independently checking their claims against source-read history. Source summaries SHALL remain available for no-op and failed-write outcomes.

#### Scenario: One page supports several facts
- **WHEN** an inspected page supports dates and venue for one Edition
- **THEN** its summary can explain both facts without presenting the page as separate independent sources

#### Scenario: A destination was not read
- **WHEN** research finds a URL but does not inspect it
- **THEN** the research model omits that URL from its informative inspected sources

### Requirement: Unsupported social retrieval is reported
When automated Facebook or Instagram content retrieval is unsupported, the run SHALL report that limitation without blocking other supported findings. [Ingestion updates](../ingestion-updates/spec.md) governs link preservation.

#### Scenario: A website and Instagram link exist
- **WHEN** research can inspect the festival website but cannot retrieve Instagram content
- **THEN** it processes the website and reports the unsupported retrieval

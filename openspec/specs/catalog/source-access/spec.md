# Source access

## Purpose

Define safe, bounded access to public evidence and the meaning of incomplete or uninspected source results.

## Requirements

### Requirement: Public pages are read within safety bounds
The source reader SHALL use bounded requests for public HTTP(S) destinations and SHALL block non-public destinations, including redirects to them, before connecting. Direct reads SHALL NOT execute page scripts locally. Internal read metadata SHALL identify the requested and final URLs, retrieval time, method, status, and available extracted content. The model response SHALL follow the page-read contract below.

#### Scenario: A readable public page
- **WHEN** a public page contains festival facts and links in its response
- **THEN** the reader returns the available facts and links in Markdown without executing its scripts

#### Scenario: An unsafe destination
- **WHEN** a requested URL or redirect resolves to a non-public destination
- **THEN** the reader blocks that request before connecting to the destination
- **AND** the model receives `status: failed` with a reason code

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

### Requirement: Page read limits remain explicit
If direct retrieval cannot check an assigned fact, configured alternate retrieval SHALL stay within shared source bounds. Internal metadata SHALL identify the method. The reader SHALL retain available text from either method and report concrete limits through `reasonCode` or `truncated`. A successful read SHALL NOT prove that all page content was obtained. Research SHALL NOT treat unavailable content as verified absence. Research completion statuses SHALL remain separate from page-read statuses.

#### Scenario: Alternate retrieval returns evidence
- **WHEN** an eligible page returns content relevant to an assigned check through configured alternate retrieval
- **THEN** the result returns that content within the model text bound
- **AND** internal metadata identifies the retrieval method

#### Scenario: Alternate retrieval cannot complete the check
- **WHEN** alternate retrieval cannot run, fails, or returns no evidence for the assigned check
- **THEN** the result retains any text from direct retrieval and reports its applicable read limit
- **AND** missing facts remain unverified
- **AND** research can return `partial` when an assigned check remains unfinished

#### Scenario: A direct request is blocked by the site
- **WHEN** a public site blocks direct retrieval and alternate retrieval is configured within the budget
- **THEN** the source result reflects the bounded attempt and its status

### Requirement: Research stays within a shared run budget

Source reads, discovery, research, editing, Location, and geocoding SHALL share a bounded run budget and deadline. The system SHALL allow relevant follow-up pages while time remains without an independent fixed page-count or link-depth cap. Initial forward and reverse geocoding requests and agent geocode calls SHALL share one finite Event-level call limit. Agent calls SHALL count even on cache hits; sharing a prepared result between Edition slots SHALL NOT count as another call. Each uncached call SHALL make at most one HTTP request without automatic retries. All work SHALL observe cancellation. At a hard limit without a usable result, the system SHALL retain the limit reason, source-read history, and available model questions. Available usage metrics SHALL follow the optional observability contract. It SHALL NOT require or invent a complete list of unfinished checks. A budget limit SHALL NOT turn an unread source into a verified absence.

#### Scenario: A relevant linked page remains available

- **WHEN** a source links to a more specific ticket or announcement page and budget remains
- **THEN** research may inspect that page before returning findings

#### Scenario: The budget expires

- **WHEN** the budget expires before a usable final result
- **THEN** the run reports the limit with available diagnostics and makes no catalog changes
- **AND** no complete list of unfinished checks is required

#### Scenario: Geocoding reaches its call bound

- **WHEN** the configured geocoding call limit is reached
- **THEN** further tool invocations return the limit result without a provider request
- **AND** Location can return a valid preservation decision with the unfinished refinement question while time remains

#### Scenario: A geocoding request fails temporarily

- **WHEN** an HTTP request fails with a timeout, rate limit, or provider error
- **THEN** preparation or the tool returns a safe failure without an automatic retry
- **AND** Location can make another explicit call within the remaining call and time limits or return a valid unresolved decision

#### Scenario: Initial requests consume the shared allowance

- **WHEN** initial forward and reverse requests prepare context for two accepted slots
- **THEN** each distinct request consumes one call from the shared Event limit
- **AND** shared results consume no extra calls and later agent calls use only the remaining allowance

#### Scenario: Location reaches the shared deadline

- **WHEN** Location cannot return a usable final plan before the run deadline
- **THEN** the run retains the limit reason and available diagnostics without applying the editor plan alone

#### Scenario: The run is cancelled during geocoding

- **WHEN** the owner cancels an active run
- **THEN** active initial or agent provider requests stop and subsequent catalog writes do not start

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

Discovery MUST serve an unknown official source, source recovery, a material identity or date conflict, or an essential missing Edition fact.
Research MUST use relevant known links and prior results before another search.
The last case MUST concern an Edition supported by inspected evidence.
Essential facts MUST concern Edition identification, dates, or publication requirements.
Missing optional facts or an unannounced next Edition alone MUST NOT justify search.
Current source-recovery restrictions MUST still apply.

#### Scenario: Official sources contain no next announcement

- **WHEN** relevant accessible official sources have been checked without finding a next announcement
- **THEN** research reports that finding without searching solely for the missing announcement
- **AND** an empty `currentOrNextEdition` slot alone does not authorize discovery

#### Scenario: A known source conflicts with Event identity

- **WHEN** relevant known links cannot resolve a material identity or date conflict
- **THEN** research can discover and inspect a candidate within the budget if the scope permits source recovery
- **AND** current identity contradictions still require full refresh without replacement-site search

#### Scenario: An identified Edition lacks an essential fact

- **WHEN** inspected evidence supports an Edition but relevant known pages leave identification, dates, or a publication-required fact unresolved
- **THEN** research can make a targeted search for that fact within the shared budget
- **AND** it uses relevant prior results before another search
- **AND** search highlights remain leads until the destination is inspected

#### Scenario: Optional information is missing

- **WHEN** only optional prices or participant size remain unknown
- **THEN** those gaps alone do not authorize discovery

#### Scenario: Sources explicitly state that no next Edition is announced

- **WHEN** inspected official material states that the next Edition has not been announced
- **THEN** research can complete that announcement check without further search

#### Scenario: A search question is resolved

- **WHEN** inspected evidence resolves the question that authorized discovery
- **THEN** that question no longer authorizes another search
- **AND** permission does not require a search for every missing field

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

### Requirement: Page reads use a small model response
`readPage` SHALL accept `{ url }`. Its response SHALL contain only `url`, `status`, `markdown`, `truncated`, optional `reasonCode`, and `remaining`. `url` SHALL identify the final destination, or the requested URL if no final destination is known. `status` SHALL be `ok`, `unsupported`, or `failed`. `remaining` SHALL contain the current `searches` and `durationMs` budget values.

#### Scenario: A supported response is received
- **WHEN** retrieval returns a supported successful response
- **THEN** `status` is `ok`, even if extracted text is empty or limited
- **AND** `reasonCode` can identify a known content limit such as `javascript_required`
- **AND** the response has no `links`, `completeness`, `attemptedUrl`, or `retrievedAt` field

#### Scenario: A source or format is unsupported
- **WHEN** the reader does not support the source or response format
- **THEN** `status` is `unsupported` and `reasonCode` identifies the limitation

#### Scenario: A read fails or is blocked
- **WHEN** a request fails, is blocked, or cannot start within the budget
- **THEN** `status` is `failed` and `reasonCode` identifies the cause
- **AND** the status is neither `blocked` nor `partial`

### Requirement: Cached Markdown is cut only for model input
The run SHALL cache full extracted Markdown from responses within the existing byte bounds. It SHALL cut text only when preparing model input, including initial inspected sources. The model response SHALL set `truncated` exactly when that projection omits cached Markdown. Projection SHALL NOT change the cached text. Repeated requests SHALL reuse cached reads, including failures, within the run.

#### Scenario: A long page is read
- **WHEN** extracted Markdown exceeds the model text bound
- **THEN** the cache retains the full extracted Markdown
- **AND** the model receives a bounded prefix with `truncated: true`

#### Scenario: Initial context has a smaller text bound
- **WHEN** initial inspected sources divide a shared text allowance among several reads
- **THEN** each projection reflects its own truncation without shortening cached reads

#### Scenario: A cached URL is read again
- **WHEN** a later request matches the requested or final URL of a cached read
- **THEN** the reader reuses that read without another request
- **AND** the model receives a fresh bounded projection and current remaining budget

### Requirement: Page regions use Markdown comments
Extracted HTML page regions SHALL use paired HTML comments for Navigation, Main content, Page header, Page footer, and Aside where those regions are identified. The extractor SHALL retain page order and links in Markdown. It SHALL NOT produce a separate extracted link list.

#### Scenario: A page contains navigation and main content
- **WHEN** the reader extracts an HTML page with navigation and main content
- **THEN** those regions use `<!-- Navigation -->` and `<!-- Main content -->` with matching closing comments
- **AND** links remain at their place in the Markdown
- **AND** visible labels such as `[Navigation]` are not generated

### Requirement: Page reads retain map context
The source reader SHALL include detected map URLs, available labels, and nearby text in Markdown. It SHALL inspect anchor links, iframe sources, and supported lazy attributes. It SHALL merge duplicate references while retaining distinct context. Ordinary Google Maps and short map links SHALL remain references without automatic map retrieval.

#### Scenario: A lazy iframe contains a venue map
- **WHEN** an iframe has `src="about:blank"` and a map URL in `data-lazy-src`
- **THEN** the result includes the map URL, available title or accessible label, and nearby context

#### Scenario: A map is repeated for desktop and mobile
- **WHEN** the page repeats a map in normal, lazy, or noscript iframe markup
- **THEN** the result merges the references and keeps distinct labels and context

#### Scenario: A normal or short Maps link is present
- **WHEN** a page links to ordinary Google Maps or a short Maps URL
- **THEN** the result retains the reference and available context without fetching its map data

### Requirement: My Maps points are read within the page call
The source reader SHALL automatically read supported Google My Maps references with `mid` from iframe sources or direct links. It SHALL support `embed`, `viewer`, and `edit` forms and read each unique map once per page call. Internal reads SHALL use the shared budget and source safety bounds. They SHALL NOT render maps, execute scripts, or follow links from map content.

#### Scenario: A page embeds a My Maps map
- **WHEN** a readable page embeds a supported My Maps URL and budget remains
- **THEN** the same `readPage` response includes its extracted point data without another Research tool call

#### Scenario: An anchor uses the edit form
- **WHEN** a page links to a public My Maps `edit` URL with `mid`
- **THEN** the reader retrieves the viewer data for that map
- **AND** duplicate embed or viewer references do not cause another map read in that call

#### Scenario: A marker contains another link
- **WHEN** a marker description contains a URL
- **THEN** the reader does not follow it

### Requirement: Map output keeps point meaning and source context
My Maps output SHALL include the map URL, available title and description, layer names, and point names, descriptions, and coordinates. The reader SHALL retain source dates and years. It SHALL NOT select a venue or infer an Edition. It SHALL skip lines and polygons with a short notice and SHALL NOT convert their display coordinates to points.

#### Scenario: Venue and parking points share a map
- **WHEN** a supported map contains a venue point and parking or camping points
- **THEN** the result includes their source names and layer context without ranking or choosing a point

#### Scenario: The map has an old date
- **WHEN** the map description names a past year
- **THEN** the result retains that year without claiming it applies to a current Edition

#### Scenario: A festival area is a polygon
- **WHEN** a map has a festival polygon and separate stage and entry points
- **THEN** the result includes the point markers and a notice that non-point geometry was skipped
- **AND** it does not return the polygon's display coordinate as a point marker

### Requirement: Map limitations preserve page evidence
The reader SHALL retain readable page content when a map fails, is blocked, has an unsupported format, or exceeds a bound. It SHALL identify the affected map and limitation in Markdown and through a reason code while retaining the readable parent page status. The cache SHALL retain full combined Markdown. Model output SHALL use the existing projection limit and truncation signal, without separate map quotas or pagination. Unread map data SHALL NOT be reported as absent.

#### Scenario: Google data cannot be parsed
- **WHEN** the map response has an unsupported or malformed data structure
- **THEN** the result retains page content and the map reference with an explicit limitation
- **AND** it does not report that the map has no markers

#### Scenario: An internal request is unsafe or exhausts the budget
- **WHEN** a map request is blocked by source safety checks or cannot complete within the budget
- **THEN** the result retains available page evidence and marks map retrieval incomplete

#### Scenario: Combined text exceeds the Markdown limit
- **WHEN** page text followed by map blocks exceeds the existing limit
- **THEN** the result uses that limit and reports projection truncation

### Requirement: Structured coordinates retain their owning object
The source reader SHALL include valid coordinate pairs from `Event.location.geo` and `Place.geo` in Markdown with the owning object's available name and structured path. It SHALL NOT treat unrelated numbers as coordinates or select a festival venue from those values.

#### Scenario: JSON-LD describes an Event location
- **WHEN** JSON-LD provides a named Event location with latitude and longitude
- **THEN** the result includes the coordinates with that location's name and structured path

#### Scenario: Several Places have coordinates
- **WHEN** JSON-LD contains several named Places with geo fields
- **THEN** each valid coordinate pair remains associated with its own Place

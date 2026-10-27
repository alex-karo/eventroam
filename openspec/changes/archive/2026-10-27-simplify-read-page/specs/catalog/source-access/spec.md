## RENAMED Requirements

- FROM: `### Requirement: Incomplete pages remain explicitly partial`
- TO: `### Requirement: Page read limits remain explicit`

## MODIFIED Requirements

### Requirement: Public pages are read within safety bounds
The source reader SHALL use bounded requests for public HTTP(S) destinations and SHALL block non-public destinations, including redirects to them, before connecting. Direct reads SHALL NOT execute page scripts locally. Internal read metadata SHALL identify the requested and final URLs, retrieval time, method, status, and available extracted content. The model response SHALL follow the page-read contract below.

#### Scenario: A readable public page
- **WHEN** a public page contains festival facts and links in its response
- **THEN** the reader returns the available facts and links in Markdown without executing its scripts

#### Scenario: An unsafe destination
- **WHEN** a requested URL or redirect resolves to a non-public destination
- **THEN** the reader blocks that request before connecting to the destination
- **AND** the model receives `status: failed` with a reason code

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

## ADDED Requirements

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

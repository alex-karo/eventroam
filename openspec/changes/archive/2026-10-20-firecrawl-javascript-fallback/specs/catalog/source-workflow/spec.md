# Spec Delta

## MODIFIED Requirements

### Requirement: Source reads use bounded HTTP without script execution
The source reader SHALL retrieve public pages through bounded HTTP requests and SHALL NOT execute page scripts locally. It SHALL retain the source URL, retrieval time, outcome, and extracted Markdown. If a page still needs script rendering after the permitted fallback, the reader SHALL report its available content as partial. Missing facts on that page SHALL NOT be treated as verified absences.

#### Scenario: HTML has useful source content
- **WHEN** a public HTML response contains readable festival facts
- **THEN** the reader extracts those facts and links without executing page scripts locally

#### Scenario: HTML depends on scripts for useful content
- **WHEN** a public HTML response has sparse body text and a script other than JSON-LD, and rendering is unavailable or does not pass the rendered-content check
- **THEN** the reader returns its available HTTP content with a partial outcome and a reason indicating that JavaScript is required
- **AND** it does not claim that missing facts were verified absent

#### Scenario: Unsafe HTTP destination
- **WHEN** a source URL or redirect points to a non-public address
- **THEN** the reader blocks the request before connecting to that destination

## ADDED Requirements

### Requirement: Sparse script-backed pages use bounded Firecrawl fallback
For HTTP 200 HTML, the reader SHALL use its existing `needsJavascript` signal to decide whether to try Firecrawl. The signal requires a script other than JSON-LD and fewer than 200 non-navigation text characters. The reader SHALL try Firecrawl at most once when `FIRECRAWL_KEY` and sufficient time within the shared deadline are available. The attempt SHALL count as another page request and use the source-size limit. The existing HTTP 403 fallback SHALL remain available.

#### Scenario: Rendered content becomes available
- **WHEN** a public HTTP 200 HTML page has `needsJavascript` and Firecrawl returns at least 200 non-navigation text characters
- **THEN** the reader selects the rendered content and links under the usual source limits
- **AND** the source history identifies Firecrawl as the successful retrieval method

#### Scenario: Short ordinary page includes a script
- **WHEN** a short public HTML page has `needsJavascript`, but Firecrawl returns fewer than 200 non-navigation text characters
- **THEN** the reader retains the direct HTTP content as partial, even if Firecrawl returned more HTML bytes or a longer placeholder

#### Scenario: Sparse page has structured data
- **WHEN** a sparse script-backed HTTP 200 page also contains JSON-LD and a rendered result passes the selection check
- **THEN** the reader includes rendered content followed by available direct HTTP content within the existing Markdown limit
- **AND** it keeps safe links from both sources within the existing link limit

#### Scenario: Rendering fails or remains sparse
- **WHEN** Firecrawl fails, returns a non-successful page, or does not pass the rendered-content check for a sparse script-backed HTTP 200 page
- **THEN** the reader retains the original HTTP content and links as a partial result
- **AND** it does not retry Firecrawl for that read

#### Scenario: Fallback is unavailable
- **WHEN** an HTTP 200 page has `needsJavascript` without a Firecrawl key or enough time remaining
- **THEN** the reader returns the direct HTTP content as partial without starting Firecrawl

#### Scenario: Existing blocked-page fallback
- **WHEN** a direct page request returns HTTP 403 and a Firecrawl key and budget are available
- **THEN** the reader still tries Firecrawl once for the final URL

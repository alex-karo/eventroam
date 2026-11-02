## MODIFIED Requirements

### Requirement: Page read limits remain explicit
If direct retrieval cannot check an assigned fact, configured alternate retrieval SHALL stay within shared source bounds. Internal metadata SHALL identify the method. The reader SHALL retain available text and links from either method and report concrete limits through `reasonCode` or `truncated`. A successful read SHALL NOT prove that all page content was obtained. Research SHALL NOT treat unavailable content as verified absence. Research completion statuses SHALL remain separate from page-read statuses.

#### Scenario: Alternate retrieval returns evidence
- **WHEN** an eligible page returns content relevant to an assigned check through configured alternate retrieval
- **THEN** the result returns that content within the model text bound
- **AND** internal metadata identifies the retrieval method

#### Scenario: Alternate retrieval returns a link without text
- **WHEN** successful alternate retrieval returns a safe link from an image with no ordinary body text
- **THEN** the page result and model tool output retain the link within the model text bound

#### Scenario: Alternate retrieval cannot complete the check
- **WHEN** alternate retrieval cannot run, fails, or returns no evidence for the assigned check
- **THEN** the result retains any text from direct retrieval and reports its applicable read limit
- **AND** missing facts remain unverified
- **AND** research can return `partial` when an assigned check remains unfinished

#### Scenario: A direct request is blocked by the site
- **WHEN** a public site blocks direct retrieval and alternate retrieval is configured within the budget
- **THEN** the source result reflects the bounded attempt and its status

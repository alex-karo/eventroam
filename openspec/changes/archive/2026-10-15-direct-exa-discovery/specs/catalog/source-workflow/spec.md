## ADDED Requirements

### Requirement: Research tool names describe their actions

Research SHALL expose `readPage` for reading a page URL and `searchWeb` for web search. Model instructions, tool registration and new log/trace tool labels SHALL use these names consistently. Old `readSource` and `discoverSources` aliases SHALL NOT be exposed. Renaming SHALL preserve page-reading behavior and existing retrieval safeguards.

#### Scenario: Registered research tools

- **WHEN** a research agent receives its tools and instructions
- **THEN** the available tool IDs and registration keys are `readPage` and `searchWeb`
- **AND** instructions use the same names without old-name aliases

#### Scenario: New tool observations

- **WHEN** a page read or web search is logged or traced
- **THEN** the selected tool label uses `readPage` or `searchWeb` respectively
- **AND** stored historical observations are not rewritten

### Requirement: Discovery candidates include bounded highlights

Discovery SHALL return unique valid HTTP(S) URLs and titles in provider order, with highlights bounded to 2,000 characters per candidate. Highlights SHALL be untrusted selection leads; catalog facts and website identity SHALL require destination inspection.

#### Scenario: Useful excerpt accompanies a candidate

- **WHEN** a search result includes highlights
- **THEN** the agent receives bounded excerpts with its candidate URL and title
- **AND** absent, blank or invalid highlights yield an empty list without discarding the candidate

#### Scenario: Unsafe or duplicate candidate

- **WHEN** search results include invalid URLs, duplicates and later valid URLs
- **THEN** discovery skips invalid and duplicate candidates and retains later valid candidates up to its configured bound

#### Scenario: Search result has not been inspected

- **WHEN** an excerpt appears to identify the event or announce dates
- **THEN** the model inspects its destination before using those facts or claiming a verified replacement website

### Requirement: Search instructions restrict discovery to exceptional cases

The discovery tool description SHALL limit search to finding an unknown official source, recovering an inaccessible or wrong official source, or resolving material identity/date conflicts with the original event information or other inspected sources. It SHALL require relevant known links and prior results first. Missing announcements or fields alone SHALL NOT justify search. The research prompt SHALL defer to these conditions without a broader search permission.

#### Scenario: No next announcement on inspected official sources

- **WHEN** the official website and accessible relevant official social sources have been checked without finding a next-edition announcement
- **THEN** instructions direct the model to report no announcement found on inspected sources without a discovery call solely to find that announcement
- **AND** no unannounced Edition is invented

#### Scenario: Wrong or inaccessible official site

- **WHEN** an official site is inaccessible or belongs to another festival and known links cannot resolve the problem
- **THEN** instructions allow discovery of an inspectable correct or alternative source

#### Scenario: Relevant candidate already exists

- **WHEN** a prior search or inspected page contains a relevant source link
- **THEN** instructions direct the model to inspect it before searching again for the same question

#### Scenario: Missing optional field

- **WHEN** inspected official sources omit an optional catalog field without a material identity/date conflict
- **THEN** instructions preserve the unknown value without searching solely to fill that field

#### Scenario: Material identity or date conflict

- **WHEN** relevant known links and prior results give event information materially conflicting with the original identity or dates, or with other inspected sources
- **THEN** instructions allow search to resolve that conflict

## MODIFIED Requirements

### Requirement: One research result governs each atomic catalog update

Research SHALL produce one final findings result. Only validated usable success/partial findings that pass country guards SHALL enter editing. Only a valid editorial plan for the requested assignment SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid research or editing SHALL produce no operations or automatic model correction attempts. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

#### Scenario: A validated proposal violates catalog constraints

- **WHEN** an editorial plan passes plan validation but violates catalog constraints, such as clearing dates while retaining scheduled status
- **THEN** the whole item remains unchanged and the run reports write_failed while preserving research status

#### Scenario: Research needs a more specific page

- **WHEN** an inspected page leaves a material question unresolved
- **THEN** the agent may read a relevant known or linked page within its budget before returning its one research result; searchWeb is allowed only under its exceptional conditions, after relevant known links and prior results

#### Scenario: Research receives saved link context

- **WHEN** a refresh starts with saved links
- **THEN** all saved links are available to research with their owner and Edition context where known

#### Scenario: Addition starts without a source URL

- **WHEN** the owner starts `add` with a festival name and no official source is known
- **THEN** the agent uses searchWeb to find a candidate source and readPage to inspect it before returning its findings

#### Scenario: Intermediate commentary is not a catalog proposal

- **WHEN** research returns commentary while still requesting source information
- **THEN** commentary produces no catalog operations; research may continue within its budget
- **AND** only the final editorial plan that passes schema and target validation can produce operations

#### Scenario: Addition already has an official source

- **WHEN** an add assignment has a relevant known official source
- **THEN** the agent inspects it with readPage before considering searchWeb
- **AND** adding by name alone does not require a search when an official source is already known

### Requirement: An unrelated website triggers discovery of the correct website

The refresh prompt SHALL instruct the model to inspect relevant known links and prior results first when a saved or candidate site belongs to another Event. Search SHALL be allowed if those links cannot establish the correct source or leave a material identity/date conflict with the original event information or other inspected sources. A replacement site SHALL require inspection. Recovery SHALL use the shared budget before returning failure. Unrelated facts SHALL NOT become target proposals. Research SHALL continue after verifying a replacement site's association. If useful target findings remain while identity is unresolved, research SHALL return partial with the contradiction in sources/unresolved; if no usable target findings remain, it SHALL return failed with null data and existing error/question diagnostics. The editor SHALL reject the whole item when a material identity contradiction remains unresolved, preventing all writes and publication.

#### Scenario: A wrong website can be replaced

- **WHEN** the saved site belongs to a namesake and discovery finds an inspectable website supported as belonging to the targeted festival
- **THEN** the model verifies that association, returns an explained replacement Event website proposal, and continues its full/current assignment
- **AND** the replacement and other accepted changes apply atomically only if all guards pass
- **AND** the rejected site's facts remain diagnostic context rather than target proposals, including when the namesake is in another country

#### Scenario: Search results alone do not confirm a replacement

- **WHEN** a search finds a matching festival name but inspection does not establish the website's association with the target
- **THEN** the model continues recovery within its remaining budget instead of treating the name or snippet as verified identity
- **AND** if no correct website can be verified, research returns partial with useful target findings and the unresolved identity contradiction, or failed with null data when no usable target findings remain; a material unresolved identity contradiction prevents all writes and publication

#### Scenario: Website recovery exhausts the budget

- **WHEN** the website is unrelated and search/time/size/agent limits are exhausted before a correct website is verified
- **THEN** research reports the recovery limitation in existing error/question diagnostics and returns partial if useful target findings remain, otherwise failed with null data
- **AND** no writes or publication occur unless the editor completes and accepts a valid plan without a material unresolved identity contradiction

#### Scenario: Useful partial findings retain an unresolved identity conflict

- **WHEN** research has useful target findings but a material contradiction about festival identity remains unresolved
- **THEN** research returns partial, retaining those findings and the contradiction in sources/unresolved
- **AND** the editor rejects the whole item with a reason; the report preserves the findings and rejection, records successful editor generation and a failed item, and contains zero operations, changes and receipts
- **AND** catalog content and publication remain unchanged

#### Scenario: A recovered website still conflicts with the saved country

- **WHEN** the correct website is verified but its matched Edition facts conflict with the saved country baseline
- **THEN** the existing whole-Event country guard still fails refresh, including the website replacement

#### Scenario: Website recovery uses the existing result contract

- **WHEN** the model finds and inspects the correct website and returns useful valid findings
- **THEN** refresh does not require a separate identity field or data.reason for the existing Event
- **AND** supplied facts retain their reasons, and partial results retain model-authored unresolved questions

#### Scenario: Known link resolves the wrong website

- **WHEN** a saved site belongs to another Event but an inspected known link establishes the correct festival website without an unresolved material identity/date conflict
- **THEN** research uses that website without searching solely to recover the wrong site

#### Scenario: Known links conflict with the original event

- **WHEN** inspected known links leave a material identity or date discrepancy with the original event information
- **THEN** instructions allow search to resolve the discrepancy rather than treating the known links as sufficient
- **AND** unrelated facts remain diagnostic context and existing country/editor guards still apply

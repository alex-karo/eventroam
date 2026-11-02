# Spec Delta

## ADDED Requirements

### Requirement: Page metadata retains its source fields
The source reader SHALL return available page-head `description`, `keywords`, `author`, `date`, `og:title`, `og:description`, `twitter:title`, and `twitter:description` as YAML in Markdown, with their source field names. These values SHALL remain source claims, not verified Edition facts. Body text SHALL remain when metadata differs. For a repeated field, the reader SHALL return the last value with a nonempty `content` attribute, without adding earlier values.

#### Scenario: Metadata supplies dates and a venue
- **WHEN** the page description gives festival dates and the Open Graph description names a venue
- **THEN** Markdown contains both values under their source field names
- **AND** the reader does not convert them into a selected Edition or verified ticket status

#### Scenario: Metadata conflicts with body text
- **WHEN** metadata gives one year or sale claim and body text gives another
- **THEN** Markdown keeps both claims with their page context
- **AND** the reader does not choose which claim is current

#### Scenario: Additional default fields exist
- **WHEN** the page head supplies `keywords`, `author`, and `date`
- **THEN** YAML includes those fields alongside the available description and social fields
- **AND** the reader does not treat `date` as a verified Edition date

#### Scenario: A metadata field repeats
- **WHEN** the page head contains two different nonempty values for `description`, followed by an empty value
- **THEN** YAML contains the last nonempty value for that field
- **AND** the reader does not add the earlier value through a separate metadata section

#### Scenario: No supported head values exist
- **WHEN** the page has no head title or supported page-head metadata
- **THEN** the reader omits YAML metadata
- **AND** it does not use metadata from an embedded document as page metadata

### Requirement: The page title comes from the page head
The source reader SHALL return the available page-head title as YAML `title` without adding a generated page-title heading. A title inside body content or an embedded document SHALL NOT supply YAML `title`. If the page head has no title, the reader SHALL omit YAML `title`. It SHALL retain body headings in page order.

#### Scenario: An embedded video supplies a title
- **WHEN** processed HTML contains a video title inside the body and no page-head title
- **THEN** the reader omits YAML `title` and does not add a page-title heading
- **AND** festival headings in the body remain available

#### Scenario: Page and embedded titles differ
- **WHEN** the page head names the festival and an embedded document names a video service
- **THEN** YAML `title` uses the festival title
- **AND** the reader does not add a generated page-title heading

### Requirement: Allowed anchors remain available without text
For anchors retained after page cleanup, the source reader SHALL keep nonempty valid HTTP(S) destinations without credentials as inline links. It SHALL use nonempty anchor text, image alternative text, `aria-label`, or `title`, in that order. If none exists, it SHALL use the resolved destination as the label. It SHALL retain distinct labelled occurrences in page order and SHALL NOT infer a label from an image filename.

#### Scenario: A ticket anchor contains only an SVG icon
- **WHEN** a retained ticket anchor has `aria-label="Tickets 2027"`, an SVG child, and a relative HTTP(S) destination
- **THEN** Markdown keeps the absolute destination with `Tickets 2027` as its label

#### Scenario: An image anchor has no alternative text
- **WHEN** a retained anchor has a valid destination but no text, image alternative text, accessible label, or title
- **THEN** Markdown keeps that destination as both label and target
- **AND** it does not invent an FAQ, ticket, or image-reading claim

#### Scenario: Labels have different values
- **WHEN** a retained anchor has text and a different accessible label
- **THEN** Markdown uses the text
- **AND** another anchor to the same destination can retain its different label

#### Scenario: A destination is not allowed
- **WHEN** an anchor destination is malformed, contains credentials, or uses a scheme other than HTTP(S)
- **THEN** the reader does not emit that destination as a link
- **AND** useful text can remain without the destination

#### Scenario: A link is removed by existing page cleanup
- **WHEN** an anchor is inside a node removed by the current hidden-content or script rules
- **THEN** this requirement does not restore that anchor
- **AND** retained anchors elsewhere on the page still use the label fallback

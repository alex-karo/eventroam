# Spec Delta

## ADDED Requirements

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

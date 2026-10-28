## MODIFIED Requirements

### Requirement: Each host serves its own crawler routes

Each configured host SHALL serve `robots.txt` and `sitemap.xml`. Robots SHALL permit public pages and query variants and identify that host's absolute sitemap URL. The apex sitemap SHALL contain its clean root and Privacy policy URL. The Festivals sitemap SHALL contain its clean root, Privacy policy URL, and all current public Event and Edition URLs. Unconfigured hosts SHALL expose no site sitemap.

#### Scenario: The two configured hosts request crawler files
- **WHEN** a crawler requests each host's robots and sitemap files
- **THEN** both files are successful responses with the correct text or XML content type
- **AND** robots references only that host's sitemap
- **AND** each sitemap lists only canonical pages owned by its host

#### Scenario: A crawler opens a page with noindex
- **WHEN** a discovery query has `noindex,follow` under the existing routing rules
- **THEN** `robots.txt` permits the crawler to read that response

#### Scenario: An unknown host requests a sitemap
- **WHEN** its host is outside the configured origin mapping
- **THEN** the request returns no public sitemap and does not fall back to Festivals

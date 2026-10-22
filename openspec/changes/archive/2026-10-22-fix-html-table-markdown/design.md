# Design

## Change size

Small. The change stays in the HTML source extractor and its tests. It changes extracted Markdown but no stored data, API shape, or dependency.

## Approach

The extractor already passes HTML through Turndown and the GFM tables plugin. Add a narrow table-cell rule after the plugin to fold whitespace from HTML line breaks and block content into an inline separator. Keep the plugin's cell boundary convention. Remove purchase quantity selectors before conversion so their option labels do not form a false number. Other table text and links continue through the existing converter.

## Risks and validation

Flattening a cell can hide a meaningful break between two facts. Use a visible separator, and test a programme cell with two lines as well as the observed Open Flair shape. A generic removal of all selectors could discard meaningful values, so limit removal to quantity controls. Run focused extractor tests and the existing read-page tests.

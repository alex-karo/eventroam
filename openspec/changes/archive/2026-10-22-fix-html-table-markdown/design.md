# Design

## Change size

Small. The change stays in the HTML source extractor and its tests. It changes extracted Markdown but no stored data, API shape, or dependency.

## Approach

The extractor already passes HTML through Turndown and the GFM tables plugin. Add a narrow table-cell rule after the plugin to fold whitespace from HTML line breaks and block content into an inline separator. Keep the plugin's cell boundary convention. Remove HTML select controls during initial DOM cleanup, before link labels are flattened, text is measured, or Markdown is converted. Their options describe possible interactions rather than a selected page fact. Other table text and links continue through the existing converter.

## Risks and validation

Flattening a cell can hide a meaningful break between two facts. Use a visible separator, and test a programme cell with two lines as well as the observed Open Flair shape. Removing select controls can discard useful option labels, so test both table and non-table controls while checking that neighboring factual text remains. Test a select nested in a link so option text cannot survive link-label flattening. Run focused extractor tests and the existing read-page tests.

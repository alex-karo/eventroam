# Design

## Change size

Small. The change stays in the HTML source extractor and its tests. It changes extracted Markdown but no stored data, API shape, or dependency.

## Approach

The extractor already passes HTML through Turndown and the GFM tables plugin. Add a narrow table-cell rule after the plugin to fold whitespace from HTML line breaks and block content into an inline separator. Keep the plugin's cell boundary convention. Add a rule for any select inside a converted table. It emits the control label and option texts as explicitly separated choices, escaping Markdown syntax and GFM table delimiters in the source text. Other table text and links continue through the existing converter.

## Risks and validation

Flattening a cell can hide a meaningful break between two facts. Use a visible separator, and test a programme cell with two lines as well as the observed Open Flair shape. Selection controls can contain meaningful options, so retain their labels and choices. Test the Open Flair quantity control, an unrelated day selector, Markdown-looking option text, and an option containing a table delimiter. Run focused extractor tests and the existing read-page tests.

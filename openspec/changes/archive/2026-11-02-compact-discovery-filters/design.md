# Design

## Change size

Medium. This joins responsive layout, pending filter state, month actions, and genre hierarchy controls. It changes no stored data or dependencies.

## Approach

Keep Discovery as the owner of applied filters, pending filters, URL writes, and result previews. Add a month row before the existing results shell. Compact the four existing picker triggers and panels. Extract the genre view from FilterPanel into a component that owns only search and branch state.

The smallest credible approach reuses current date bounds, genrePickerTree, ancestry matching, previewFilters, and native inputs. It needs no new picker library or catalog request. A flat list would remove branch controls but lose the approved hierarchy.

## Contracts

Months commit through the existing apply path and keep focus on the clicked month or All button instead of restoring the picker trigger. All sets from and to to empty strings, which restores the existing upcoming and ongoing rule. Custom dates retain validation and pending Apply. The month row covers the visitor's local current month and the next 11 months. Month controls show short names with accessible year labels.

FilterPanel and its group fields stay mounted while the draft is open. Inactive groups use hidden so native unfinished edits and validation stay on the same inputs. Pending state is shared across picker groups. A group switch retains it; cancel discards it. Immediate month actions use applied state and dismiss the pending draft. Existing URL validation and readable applied chips remain in use.

## Architecture

MonthStrip builds local calendar bounds and renders grouped years. Discovery passes applied date bounds and an apply callback. FilterPanel retains native date and duration feedback, previews, and its footer. GenreChoices receives the eligible tree, selected slugs, and a change callback. It derives ancestry from that tree. The existing model remains the owner of matching.

## Key decisions

Use native checkboxes with indeterminate state for partial parents. A selected ancestor covers descendants. Its descendants are checked and disabled with Included text. Selecting a parent removes redundant selected descendants. Existing direct URLs may contain redundant slugs; display them without changing the URL until the visitor edits the genre selection. Removing a parent removes any explicitly selected descendants in that branch too. Other genre edits remove redundant descendant slugs.

Search retains matching ancestor paths and opens them. Normal branch state stays separate from search. Selected chips remain visible outside the scrolling list. The default opens the paths of selected children; other branches start closed. This keeps a large catalog compact without hiding existing selections.

Use a narrow panel with a fixed header and footer and a flexible scrolling body. The genre search and selected summary stay outside the list scroll. At 320px, all four triggers remain available. Coarse pointers get 44px targets. Keep a visible thin scrollbar in the genre list; hide only the month scrollbar as approved.

## Risks and validation

Check month rollover, leap-year bounds, exact month highlighting, and All with unrelated filters. Check genre search, partial selection, parent replacement, inherited controls, zero-result selections, and cancel with React tests. Update existing browser journeys for Dates and Music on both layouts. Use the built-in Browser at desktop and 320px to check panel size, overflow, focus, and the shared preview count. Run type, lint, focused tests, build, and OpenSpec checks.

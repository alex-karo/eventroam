# Design

## Change size

Small: shared model instructions and one validation message path.

## Approach

Extend the shared instructions with the [classification rules](specs/catalog/classification/spec.md). Add the editor correction rule and increase both prompt versions.

The domain validator still owns facet counts. Use a count-error type so preparation can forward its specific message without exposing other exceptions. Keep the generic fallback for other facet errors.

Preparation resolves `accept` into a complete `set`. It validates that list before removing redundant ancestors and creating operations.

## Risks and validation

Check rejected `accept` and corrected `set` for both Edition slots. Check shared prompt rules. Reuse format, ownership, and writer tests. These checks verify host behavior and prompt delivery, not live model compliance. Commands and documentation work are in [tasks](tasks.md). Do not run ingestion or saved-plan recovery.

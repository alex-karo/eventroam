# Eventroam

Eventroam is a worldwide event catalog in English. See the [README](README.md) for the product and deployment status.

## Change workflow

Use fast track for clear, local changes with low risk, including small changes to behavior. Implement the change and run focused checks. Edit the relevant main spec directly if the change affects an existing requirement or adds a durable rule.

Use full OpenSpec when the user asks for it or the work meets one of these conditions.

- It adds a capability or makes a material change to a contract.
- It poses a material risk to stored data, security, or privacy.
- It needs a product decision or a design decision that affects several components.

When you change a contract, consider its existing consumers and production data. Read the [change workflow](docs/change-workflow.md#choose-a-workflow) for full OpenSpec or help choosing a workflow.

Correct statements that the change makes inaccurate. Add information only when readers need it for a specific task or to understand a lasting rule or decision. For help placing information, see [Update documentation](docs/change-workflow.md#update-documentation). Run `pnpm run openspec:validate` for OpenSpec edits and `pnpm run docs:check` for documentation edits.

## Project references

Use the [main OpenSpec specs](openspec/specs/) for current contracts. They are grouped by `catalog/`, `website/`, and `operations/`. Check the code for exact behavior. [Active changes](openspec/changes/) describe approved future work. [Draft proposals](docs/proposals/) hold open choices.

Use the [development guide](docs/development.md) for local setup and commands. Use the [documentation index](docs/index.md) to find other guides.

## Database validation

Keep business validation and extensible vocabularies in application code. Do not add SQL `CHECK` constraints or business validation triggers. SQLite enforces keys, uniqueness, `NOT NULL`, and immutability for audit history and public URL aliases.

Reuse operation validators. Validate related state in the write transaction. Use applicable shared validation in fixture loaders and normal test helpers. Prefer existing operation guarantees over duplicate storage row schemas. Follow [storage integrity](openspec/specs/operations/storage-integrity/spec.md) for schema changes.

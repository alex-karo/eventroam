# Documentation criteria

Use these questions to reduce maintenance without making needed information hard to find. They do not require a new folder structure, metadata scheme, or tool.

## What needs to stay?

- Does this information support a reader task, explain a contract, or record a needed reason for a decision?
- Can implementation details be obtained reliably from code? If so, remove the prose copy and provide a module path or search method when useful.
- Is a unique detail still unnecessary? Uniqueness alone does not justify keeping it. Frequent change is a reason to assess its value, not automatic grounds for deletion.

For example, remove a list of internal helper functions when a module path is enough. Keep an exact recovery command needed for an operational task, even if it sometimes changes.

## Where does each rule belong?

- Is there one primary source for the full rule, with links elsewhere?
- Can a brief local reminder support correct action without becoming a second full definition?
- When removing a duplicate, does the primary source retain all needed conditions and exceptions?

A short permission condition beside a command is useful. Its full rationale can live in the linked specification.

## Is the text short and well structured?

- Do titles and headings name concrete tasks or subjects?
- Can empty introductions, repeated conclusions, and unnecessary examples be removed?
- Can dense paragraphs become short sections, steps, or a comparison table where appropriate?
- Does English text follow ASD-STE100: short, direct sentences, consistent terms, clear actions, and no ambiguous wording? Keep technical names and command syntax exact; follow project language rules.
- Can the file be improved before splitting it? Split for independent tasks; merge parts that readers need together and that repeat context.

Do not set fixed word or line limits. A long, coherent reference can cost less to maintain than many small files. Do not split a procedure from the exceptions needed to perform it.

## Does progressive disclosure work?

1. Detail matches the document's role in the navigation structure, not just its directory depth. Top-level guides such as a development guide give orientation, common actions, and links with few details. Linked topic guides (spokes) can explain task-specific procedures, exceptions, and examples.
2. The entry point makes it clear which document to open and why.
3. Each task document makes sense when opened directly, without chat history or the whole documentation set.
4. Required conditions are visible before the action they control.
5. Optional details are linked where needed. Link labels explain what the destination provides or when to read it.

Avoid unexplained file lists, circular links, and chains of empty index pages. Use concise context and descriptive links instead of copying whole overviews. Keep a warning beside its command even when the full explanation lives elsewhere.

Move useful specialist detail from an overview to an existing topic guide where possible. Create a new topic guide only for a coherent reader task. Greater depth permits useful detail; it does not justify a prose copy of changing code internals.

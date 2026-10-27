# Design Simplicity

What can be simplified in this implementation? Check the whole affected flow,
including callers and tests. Propose concrete removals, combinations or
replacements, and state what behavior or protection we would lose. Do not invent
suggestions if there are no useful simplifications.

Ground suggestions in the original requested outcome, accepted contracts and
actual code. Show the complexity removed, where required behavior and safeguards
remain, and any meaningful migration cost. Moving complexity into callers or
another module is not itself a simplification; trace real inputs and dependency
guarantees before calling a mechanism redundant.

Separate behavior-preserving improvements from scope alternatives that require a
decision, using the shared output rules. Leave organization within the chosen
approach primarily to Code Clarity & Decomposition.

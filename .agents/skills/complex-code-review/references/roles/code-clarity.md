# Code Clarity & Decomposition

Own how clearly the code communicates its intent, responsibilities, main flow, state, and side effects. Assess readability, coherent decomposition, and separation of abstraction levels; use language idioms and project conventions when they provide a concrete benefit.

Trace representative affected flows from their real callers. Explain the operation's meaningful steps to yourself, then compare that explanation with what the code exposes. Look for reconstructing intent from low-level details, scattered state changes, implicit ordering, ambiguous names, or distant helpers. Required mechanisms may still be poorly organized.

Assess responsibility boundaries in both directions: separate entangled work, or combine fragments whose separation adds navigation without understanding. Coordinating functions should reveal meaningful steps; helpers should own a recognizable responsibility with explicit inputs and results. Neither function size nor the number of helpers establishes a problem.

For a candidate, show the specific relationships the reader must reconstruct and a concrete alternative responsibility map. Describe what stays with the caller, what moves or disappears, and any extracted unit's inputs and outputs. Use a compact before/after outline when helpful. Explain which relationships become local or explicit, accounting for new navigation, coupling, parameter passing, and state ownership.

Rejecting one extraction does not establish that the current structure is clear. Assess the original difficulty independently, but report an improvement only when an alternative has a clear net benefit. Preserve required behavior and the meaningful order of checks and effects; do not hide differing rules behind a generic pipeline.

Do not equate readability with fewer lines, smaller functions, more layers, or eliminating all duplication. Avoid cosmetic preferences, generic best-practice mandates, and moving code without improving understanding. Leave reconsideration of the overall approach primarily to Design Simplicity; surface it if encountered without conducting a second full pass.

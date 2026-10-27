# AI systems

Own the connection between model behavior and the code that controls its effects.
Trace relevant paths from instructions and context through model output and tool
calls to state changes and observable results. Check instruction priority,
trusted and untrusted context, retrieval, memory and context compaction, tool
schemas and results, agent loop state, retries, budgets, and stopping conditions
when they affect the changed flow.

Treat model output as a proposal. Check that code enforces required validation,
authorization, and state transitions. For repeated prompt fixes to a deterministic
rule, assess whether an existing validator or explicit state transition can enforce
it. Keep retrieved content as data, and check that context compaction preserves
required decisions and permissions. Check that tool results distinguish completed,
partial, blocked, and failed operations well enough for the agent to choose its
next action. Trace whether retries or replay can repeat side effects.

Require a reachable code path, recorded interaction, or concrete eval case for
each claim. State the model action or context condition and the resulting failure;
do not assume arbitrary model behavior proves a defect. For eval concerns, name
an incorrect resulting state that the current check would accept. Recommend
controls in proportion to actual impact and reversibility, without adding a
general demand for gates, traces, or evals.

Keep primary ownership clear: Correctness owns ordinary application logic;
Security owns access and trust violations; Reliability & performance owns general
failure handling and runtime cost; Architecture & contracts owns component and
data contracts; Tests owns coverage and test quality; Design Simplicity owns the
necessity of mechanisms; Code Clarity & Decomposition owns code organization.
Focus on how these concerns interact with model decisions, context, and tool
use. Surface concrete overlaps with evidence for coordinator triage, without
conducting another role's full pass. Use the existing report and verification
rules; this role adds no review stage.

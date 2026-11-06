# Design

## Change size

Small. The command changes how it starts ingestion and displays results. The Studio workflow, report format, and stored data stay the same.

## Approach

The CLI validates arguments and calls the native `catalog-ingestion` API. For each target it prints a fresh workflow execution ID and sends it to `start-async`. Mastra creates the run and returns its final result. Studio selects the catalog, loads provider settings, and owns workflow history and diagnostics. The command defaults to `http://127.0.0.1:4111` and accepts another loopback origin with `--url`.

## Contracts

The terminal shows the workflow result and IDs. `--json` prints the existing final summary and safe failure codes. Studio retains field changes, reasons, and source evidence for inspection. Removing `--report` eliminates duplicate reports and file collision checks. Set catalog paths and research limits in the Studio environment.

The command continues after an item fails and exits nonzero if any item fails. If the connection drops after start, the outcome is unknown. The CLI keeps the execution ID for inspection and does not retry. Closing the CLI can leave the run active. Cancel it in Studio if needed.

## Risks and validation

Use the offline Studio fixture to check that the command waits for completion, a preview keeps the catalog unchanged, and a failure retains safe run identifiers. Check the response before printing it. Print only selected fields and approved error codes.

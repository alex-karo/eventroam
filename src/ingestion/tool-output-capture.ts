import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeObservabilityStderr } from "./runtime/observability/stderr";

type Origin = "initial-source" | "readPage" | "searchWeb";

/** An attempt-local, best-effort record of values at the agent boundary. */
export class ToolOutputCapture {
  private nextSequence = 0;
  private failed = false;
  private directory?: string;

  constructor(
    private readonly runId: string,
    private readonly root = join(process.cwd(), "data", "catalog-debug"),
  ) {}

  reserve(): number {
    return ++this.nextSequence;
  }

  save(
    sequence: number,
    origin: Origin,
    result: unknown,
    toolCallId?: string,
  ): void {
    if (this.failed) {
      return;
    }
    try {
      if (!this.directory) {
        mkdirSync(this.root, { recursive: true, mode: 0o700 });
        this.directory = join(this.root, this.runId);
        mkdirSync(this.directory, { mode: 0o700 });
      }
      const stem = `${String(sequence).padStart(5, "0")}-${origin}`;
      const record = {
        sequence,
        runId: this.runId,
        origin,
        ...(toolCallId ? { toolCallId } : {}),
        result,
      };
      writeFileSync(
        join(this.directory, `${stem}.json`),
        JSON.stringify(record, null, 2) + "\n",
        {
          flag: "wx",
          mode: 0o600,
        },
      );
      const markdown = pageMarkdown(result);
      if (markdown !== undefined) {
        writeFileSync(join(this.directory, `${stem}.md`), markdown, {
          flag: "wx",
          mode: 0o600,
        });
      }
    } catch {
      this.failed = true;
      writeObservabilityStderr(
        `catalog_capture_write_failed runId=${this.runId} phase=${origin}\n`,
      );
    }
  }
}

function pageMarkdown(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("markdown" in result)) {
    return undefined;
  }
  return typeof result.markdown === "string" ? result.markdown : undefined;
}

export function createToolOutputCapture(
  runId: string,
): ToolOutputCapture | undefined {
  return process.env.CATALOG_CAPTURE_TOOL_OUTPUTS === "true"
    ? new ToolOutputCapture(runId)
    : undefined;
}

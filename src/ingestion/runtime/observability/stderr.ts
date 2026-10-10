import type { Writable } from "node:stream";

const failedStreams = new WeakSet<Writable>();
const observedStreams = new WeakSet<Writable>();

/** A closed progress pipe must not interrupt research or diagnostic cleanup. */
export function writeObservabilityStderr(
  line: string,
  onFailure: () => void = () => {},
) {
  const stream = process.stderr;
  if (failedStreams.has(stream)) {
    return;
  }
  // Node emits asynchronous write errors after invoking the write callback.
  // Install only one listener per stream; keep it for delayed error emissions.
  if (!observedStreams.has(stream)) {
    observedStreams.add(stream);
    stream.on("error", () => failedStreams.add(stream));
  }
  let notified = false;
  const failed = () => {
    failedStreams.add(stream);
    if (!notified) {
      notified = true;
      onFailure();
    }
  };
  try {
    stream.write(line, (error) => {
      if (error) {
        failed();
      }
    });
  } catch {
    failed();
  }
}

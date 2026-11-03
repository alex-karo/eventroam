import { check } from "./checks";

export type EvalToolCall =
  | { tool: "readPage"; url: string }
  | { tool: "searchWeb"; query: string }
  | {
      tool: "geocode";
      observation: import("../tools/geocode/tool").GeocodingObservation;
    };

export function searchCount(calls: EvalToolCall[]) {
  return calls.filter((call) => call.tool === "searchWeb").length;
}

export function readBeforeSearch(
  calls: EvalToolCall[],
  url: string,
  searchIndex: number,
) {
  const read = calls.findIndex(
    (call) =>
      call.tool === "readPage" && new URL(call.url).href === new URL(url).href,
  );
  const search = calls
    .flatMap((call, index) => (call.tool === "searchWeb" ? [index] : []))
    .at(searchIndex - 1);
  return check(
    `toolUse.readBeforeSearch.${searchIndex}`,
    read >= 0 && (search === undefined || read < search),
    `read ${url} before search #${searchIndex}, if needed`,
  );
}

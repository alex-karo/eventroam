// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import {
  beginVisit,
  historyVisitToken,
  readVisit,
  returnHref,
  saveVisit,
  withDiscovery,
  type DiscoveryVisit,
} from "./discovery-context";
import {
  normalizeDiscoveryLocation,
  pushDiscoveryFilters,
  pushDiscoveryView,
} from "@/features/discovery/hooks/discovery-url";
import { emptyFilters } from "@/features/discovery/model/discovery";
const snapshot: DiscoveryVisit = {
  rootUrl: "/?country=PT&view=map",
  camera: { latitude: 38, longitude: -9, zoom: 8 },
  scroll: 125,
  selectedId: "edition",
  expanded: true,
};
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(
    { __NA: true, tree: "framework" },
    "",
    "/?country=PT&view=map",
  );
});
test("full snapshots stay in tab storage and only tokens enter framework history", () => {
  const { token } = beginVisit();
  saveVisit(token, snapshot);
  expect(window.history.state).toEqual({
    __NA: true,
    tree: "framework",
    eventroamDiscovery: token,
  });
  expect(readVisit(token)).toEqual(snapshot);
  expect(beginVisit().visit).toEqual(snapshot);
  expect(returnHref(token)).toBe(withDiscovery(snapshot.rootUrl, token));
  window.history.replaceState({ __NA: true }, "", returnHref(token));
  expect(beginVisit()).toEqual({ token, visit: snapshot });
  expect(window.location.search).toBe("?country=PT&view=map");
  window.history.replaceState({ __NA: true }, "", withDiscovery("/", token));
  expect(beginVisit()).toEqual({ token, visit: snapshot });
  expect(window.location.search).toBe("?country=PT&view=map");
  normalizeDiscoveryLocation("country=PT");
  expect(historyVisitToken()).toBe(token);
  expect(window.history.state.__NA).toBe(true);
  const viewToken = pushDiscoveryView("list");
  expect(viewToken).not.toBe(token);
  expect(historyVisitToken()).toBe(viewToken);
  expect(window.history.state).toEqual({
    __NA: true,
    eventroamDiscovery: viewToken,
  });
  const filterToken = pushDiscoveryFilters(emptyFilters());
  expect(filterToken).not.toBe(viewToken);
  expect(historyVisitToken()).toBe(filterToken);
  expect(window.history.state).toEqual({
    __NA: true,
    eventroamDiscovery: filterToken,
  });
  expect(readVisit(token)).toEqual(snapshot);
});
test("direct details never pick unrelated searches and invalid snapshots cannot supply return URLs", () => {
  saveVisit("unrelated", snapshot);
  expect(returnHref(null)).toBe("/");
  expect(returnHref("missing")).toBe("/");
  saveVisit("bad", { ...snapshot, rootUrl: "https://attacker.example/" });
  expect(readVisit("bad")).toBeNull();
  window.history.replaceState({}, "", "/?country=ES&discovery=unrelated");
  expect(beginVisit().visit).toBeNull();
  expect(window.location.search).toBe("?country=ES");
});
test("disabled storage keeps ordinary link and filter fallbacks", () => {
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  expect(returnHref("visit")).toBe("/");
  expect(beginVisit().visit).toBeNull();
  spy.mockRestore();
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage blocked");
    });
  expect(() => saveVisit("visit", snapshot)).not.toThrow();
  write.mockRestore();
});

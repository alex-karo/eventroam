// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PublicOccurrence } from "@/catalog/read/contracts";
import { testFixtures } from "@/test/fixtures";
import { useSelectedEdition } from "./use-selected-edition";

const edition: PublicOccurrence = {
  ...testFixtures().build.summary({ id: "edition-1" }),
  eventId: "event-1",
  venueAddress: null,
  hasCoordinates: false,
  ticketCategories: [],
  priceKind: null,
  priceCurrency: null,
  priceMinMinor: null,
  priceMaxMinor: null,
  priceCoverage: null,
  priceQualification: null,
  terms: [],
  links: [],
};

function pendingResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const response = (data = edition) => Response.json(data);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("selection exposes loading, encodes the ID and loads uncached details", async () => {
  const pending = pendingResponse();
  fetchMock.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useSelectedEdition(() => null));
  expect(result.current.state).toEqual({ status: "idle" });
  expect(result.current.selectedId).toBeNull();
  let selection!: Promise<void>;
  act(() => {
    selection = result.current.select("edition/1");
  });
  expect(result.current.state).toEqual({ status: "loading", id: "edition/1" });
  expect(result.current.selectedId).toBe("edition/1");
  expect(fetchMock).toHaveBeenCalledWith("/api/discovery/edition%2F1", {
    cache: "no-store",
  });
  await act(async () => {
    pending.resolve(response());
    await selection;
  });
  expect(result.current.state).toEqual({
    status: "ready",
    id: "edition/1",
    data: edition,
  });
});

test.each(["http", "network", "json"] as const)(
  "%s failure can be retried for the same edition",
  async (failure) => {
    if (failure === "network") {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
    } else {
      fetchMock.mockResolvedValueOnce(
        failure === "http"
          ? new Response(null, { status: 404 })
          : new Response("invalid json"),
      );
    }
    fetchMock.mockResolvedValueOnce(response());
    const { result } = renderHook(() => useSelectedEdition(() => null));
    await act(async () => {
      await result.current.select(edition.id);
    });
    expect(result.current.state).toEqual({ status: "error", id: edition.id });
    await act(async () => {
      await result.current.select(edition.id);
    });
    expect(result.current.state).toEqual({
      status: "ready",
      id: edition.id,
      data: edition,
    });
  },
);

test.each(["success", "failure"] as const)(
  "late %s from a previous selection cannot replace the current edition",
  async (outcome) => {
    const first = pendingResponse();
    const second = { ...edition, id: "edition-2" };
    fetchMock
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(response(second));
    const { result } = renderHook(() => useSelectedEdition(() => null));
    let selection!: Promise<void>;
    act(() => {
      selection = result.current.select(edition.id);
    });
    await act(async () => {
      await result.current.select(second.id);
    });
    await act(async () => {
      if (outcome === "success") {
        first.resolve(response());
      } else {
        first.reject(new Error("late failure"));
      }
      await selection;
    });
    expect(result.current.state).toEqual({
      status: "ready",
      id: second.id,
      data: second,
    });
  },
);

test.each(["success", "failure"] as const)(
  "closing during loading ignores a late %s",
  async (outcome) => {
    const pending = pendingResponse();
    fetchMock.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useSelectedEdition(() => null));
    let selection!: Promise<void>;
    act(() => {
      selection = result.current.select(edition.id);
    });
    act(() => {
      result.current.close();
    });
    await act(async () => {
      if (outcome === "success") {
        pending.resolve(response());
      } else {
        pending.reject(new Error("late failure"));
      }
      await selection;
    });
    expect(result.current.state).toEqual({ status: "idle" });
    expect(result.current.selectedId).toBeNull();
  },
);

test("unmount during loading tolerates a late response", async () => {
  const pending = pendingResponse();
  fetchMock.mockReturnValue(pending.promise);
  const { result, unmount } = renderHook(() => useSelectedEdition(() => null));
  let selection!: Promise<void>;
  act(() => {
    selection = result.current.select(edition.id);
  });
  unmount();
  pending.resolve(response());
  await selection;
  expect(result.current.state).toEqual({ status: "loading", id: edition.id });
});

function focusHarness() {
  let hook!: ReturnType<typeof useSelectedEdition>;
  function Harness() {
    hook = useSelectedEdition(() =>
      document.querySelector<HTMLButtonElement>("[data-fallback]"),
    );
    return (
      <>
        <button data-origin>Open edition</button>
        <button data-fallback>Results</button>
        {hook.selectedId && (
          <section ref={hook.panelRef}>
            <button>Close</button>
          </section>
        )}
      </>
    );
  }
  const view = render(<Harness />);
  const origin = view.getByText("Open edition");
  const fallback = view.getByText("Results");
  // jsdom has no layout; declare that the trigger is still visible.
  vi.spyOn(origin, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList);
  return { view, origin, fallback, current: () => hook };
}

test("opening focuses the panel; changing selection inside it retains the original trigger", async () => {
  fetchMock.mockResolvedValue(response());
  const harness = focusHarness();
  harness.origin.focus();
  await act(async () => {
    await harness.current().select(edition.id);
  });
  expect(document.activeElement).toBe(harness.view.getByText("Close"));
  await act(async () => {
    await harness.current().select("edition-2");
  });
  act(() => {
    harness.current().close();
  });
  expect(document.activeElement).toBe(harness.origin);
});

test("closing restores fallback focus when the original trigger is no longer visible", async () => {
  fetchMock.mockResolvedValue(response());
  const harness = focusHarness();
  harness.origin.focus();
  await act(async () => {
    await harness.current().select(edition.id);
  });
  vi.mocked(harness.origin.getClientRects).mockReturnValue({
    length: 0,
  } as DOMRectList);
  act(() => {
    harness.current().close();
  });
  expect(document.activeElement).toBe(harness.fallback);
});

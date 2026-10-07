import { useEffect, useRef, useState } from "react";
import type { PublicOccurrence } from "@/catalog/read/contracts";

export type DetailState =
  | { status: "idle" }
  | { status: "loading" | "error"; id: string }
  | { status: "ready"; id: string; data: PublicOccurrence };

export function useSelectedEdition(fallbackFocus: () => HTMLElement | null) {
  const [state, setState] = useState<DetailState>({ status: "idle" });
  const selectedId = state.status === "idle" ? null : state.id;
  const requestGeneration = useRef(0);
  const origin = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const generation = requestGeneration;
    return () => {
      ++generation.current;
    };
  }, []);

  useEffect(() => {
    if (selectedId) {
      panelRef.current?.querySelector("button")?.focus();
    }
  }, [selectedId]);

  async function select(id: string) {
    if (
      selectedId !== id &&
      document.activeElement instanceof HTMLElement &&
      !panelRef.current?.contains(document.activeElement)
    ) {
      origin.current = document.activeElement;
    }
    const request = ++requestGeneration.current;
    setState({ status: "loading", id });
    try {
      const response = await fetch(`/api/discovery/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Detail unavailable");
      }
      const next = (await response.json()) as PublicOccurrence;
      if (request === requestGeneration.current) {
        setState({ status: "ready", id, data: next });
      }
    } catch {
      if (request === requestGeneration.current) {
        setState({ status: "error", id });
      }
    }
  }

  function close() {
    ++requestGeneration.current;
    setState({ status: "idle" });
    requestAnimationFrame(() => {
      if (origin.current?.getClientRects().length) {
        origin.current.focus();
      } else {
        fallbackFocus()?.focus();
      }
    });
  }

  return { state, selectedId, panelRef, select, close };
}

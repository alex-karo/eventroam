import { useEffect, useEffectEvent, useRef, useState } from "react";
import posthog from "posthog-js";
import type { Genre } from "@/catalog/read/contracts";
import {
  beginVisit,
  historyVisitToken,
  saveVisit,
  type Camera,
} from "@/site/discovery-context";
import { serializeFilters, type Filters } from "../model/discovery";
import {
  normalizeDiscoveryLocation,
  pushDiscoveryFilters,
  pushDiscoveryView,
  readDiscoveryLocation,
  type DiscoveryView,
} from "./discovery-url";

export function useDiscoveryVisit({
  initialView,
  applied,
  genres,
  selectedId,
  restoreFilters,
  restoreSelection,
}: Readonly<{
  initialView: DiscoveryView;
  applied: Filters;
  genres: Genre[];
  selectedId: string | null;
  restoreFilters: (filters: Filters | null, error: string | null) => void;
  restoreSelection: (id: string | null, filters: Filters | null) => void;
}>) {
  const [view, setView] = useState(initialView);
  const [followMap, setFollowMap] = useState(true);
  const [visitToken, setVisitToken] = useState<string | null>(null);
  const [visitReady, setVisitReady] = useState(false);
  const [restoreCamera, setRestoreCamera] = useState<Camera | null>(null);
  const [preserveSelectionCamera, setPreserveSelectionCamera] = useState(false);
  const camera = useRef<Camera | null>(null);
  const listColumn = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const pendingListScroll = useRef<number | null>(null);

  function saveContext() {
    const token = historyVisitToken();
    if (!token) {
      return;
    }
    if (
      listColumn.current?.clientHeight &&
      pendingListScroll.current === null
    ) {
      listScroll.current = listColumn.current.scrollTop;
    }
    saveVisit(token, {
      rootUrl: `${window.location.pathname}${window.location.search}`,
      camera: camera.current,
      scroll: listScroll.current,
      selectedId,
      followMap,
    });
  }

  const saveCurrentContext = useEffectEvent(saveContext);
  const restoreContext = useEffectEvent(() => {
    const { token, visit } = beginVisit();
    setVisitToken(token);
    setVisitReady(true);
    const location = readDiscoveryLocation(genres);
    setView(location.view);
    restoreFilters(location.filters, location.error);
    if (location.filters && !location.error) {
      normalizeDiscoveryLocation(serializeFilters(location.filters).toString());
    }
    camera.current = visit?.camera ?? null;
    setRestoreCamera(visit?.camera ?? null);
    setPreserveSelectionCamera(!!visit?.camera);
    setFollowMap(visit?.followMap ?? true);
    listScroll.current = visit?.scroll ?? 0;
    pendingListScroll.current = listScroll.current;
    restoreSelection(
      visit?.selectedId ?? null,
      location.error ? null : location.filters,
    );
  });

  const restoreListScroll = useEffectEvent(() => {
    const column = listColumn.current;
    if (column?.clientHeight && pendingListScroll.current !== null) {
      const scroll = pendingListScroll.current;
      pendingListScroll.current = null;
      column.scrollTop = scroll;
    }
  });
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restoreListScroll);
    });
    const observer = new ResizeObserver(restoreListScroll);
    if (listColumn.current) {
      observer.observe(listColumn.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [view, visitToken, selectedId, applied]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        restoreContext();
      }
    });
    const restore = () => restoreContext();
    const save = () => saveCurrentContext();
    window.addEventListener("popstate", restore);
    window.addEventListener("pagehide", save);
    return () => {
      active = false;
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  useEffect(() => {
    if (visitReady) {
      saveCurrentContext();
    }
  }, [visitReady, visitToken, selectedId, applied, view, followMap]);

  function pushFilters(filters: Filters) {
    saveContext();
    setVisitToken(pushDiscoveryFilters(filters));
  }

  function saveAndKeepListScroll() {
    saveContext();
    pendingListScroll.current = listScroll.current;
  }

  function switchView(next: DiscoveryView) {
    if (next === view) {
      return;
    }
    saveAndKeepListScroll();
    posthog.capture("discovery_view_changed", { view: next });
    setView(next);
    setVisitToken(pushDiscoveryView(next));
  }

  function changeCamera(next: Camera) {
    camera.current = next;
    saveContext();
  }

  return {
    view,
    switchView,
    visitReady,
    followMap,
    setFollowMap,
    restoreCamera,
    preserveSelectionCamera,
    setPreserveSelectionCamera,
    changeCamera,
    listColumn,
    saveContext,
    pushFilters,
    saveAndKeepListScroll,
  };
}

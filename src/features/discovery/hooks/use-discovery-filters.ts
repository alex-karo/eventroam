import { useRef, useState } from "react";
import posthog from "posthog-js";
import type { FilterGroup } from "../components/filter-groups";
import {
  emptyFilters,
  filterSummaries,
  normalizeFilters,
  type Filters,
} from "../model/discovery";
import { filterSelections } from "../model/filter-feedback";
import type { DiscoveryCatalog } from "./use-discovery-catalog";

export function useDiscoveryFilters({
  initialFilters,
  initialError,
  catalog,
  today,
}: Readonly<{
  initialFilters: Filters;
  initialError: string | null;
  catalog: DiscoveryCatalog;
  today: Date;
}>) {
  const [applied, setApplied] = useState(initialFilters);
  const [pending, setPending] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [urlError, setUrlError] = useState(initialError);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [panel, setPanel] = useState<FilterGroup | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const triggers = useRef<
    Partial<Record<FilterGroup, HTMLButtonElement | null>>
  >({});

  function restoreFocus() {
    const button = opener.current;
    if (button?.isConnected && button.getClientRects().length) {
      button.focus();
    } else {
      triggers.current[panel ?? "where"]?.focus();
    }
  }

  function closePanel() {
    setPending(applied);
    setPanel(null);
    setFormError(null);
    requestAnimationFrame(restoreFocus);
  }

  function openPanel(group: FilterGroup, button: HTMLButtonElement) {
    if (panel === group) {
      closePanel();
      return;
    }
    opener.current = button;
    if (!panel) {
      setPending(applied);
      setFormError(null);
    }
    setPanel(group);
  }

  function restore(next: Filters | null, error: string | null) {
    if (next) {
      setApplied(next);
      setPending(next);
      setQuery(next.q);
    }
    setUrlError(error);
    setFormError(null);
    setSearchError(null);
    setPanel(null);
  }

  function apply(
    next: Filters,
    pushFilters: (filters: Filters) => void,
    source: "search" | "filters" | "months" = "filters",
  ) {
    if (source === "search") {
      setPanel(null);
      setPending(applied);
      setFormError(null);
    }
    try {
      const valid = normalizeFilters(next, catalog.genres);
      const resultCount = filterSummaries(
        catalog.summaries,
        valid,
        catalog.genres,
        today,
      ).length;
      posthog.capture(
        source === "search"
          ? "discovery_search_submitted"
          : "discovery_filters_applied",
        {
          active_filter_count: filterSelections(valid, catalog.genres).length,
          has_search_query: Boolean(valid.q),
          result_count: resultCount,
        },
      );
      pushFilters(valid);
      restore(valid, null);
      if (panel && source === "filters") {
        requestAnimationFrame(restoreFocus);
      }
    } catch (caught) {
      const setError = source === "search" ? setSearchError : setFormError;
      setError(caught instanceof Error ? caught.message : "Invalid filters.");
    }
  }

  function changeQuery(value: string) {
    setQuery(value);
    setSearchError(null);
  }

  return {
    applied,
    pending,
    setPending,
    query,
    changeQuery,
    urlError,
    formError,
    searchError,
    panel,
    setPanel,
    triggers,
    openPanel,
    closePanel,
    restore,
    apply,
    search: (pushFilters: (filters: Filters) => void) =>
      apply({ ...applied, q: query }, pushFilters, "search"),
    clear: (pushFilters: (filters: Filters) => void) =>
      apply(emptyFilters(), pushFilters),
  };
}

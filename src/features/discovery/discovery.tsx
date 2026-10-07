"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyFilters,
  filterSummaries,
  normalizeFilters,
  type Filters,
} from "@/features/discovery/model/discovery";
import type {
  DiscoverySummary,
  Genre,
  PublicOccurrence,
} from "@/catalog/read/contracts";
import { FilterPanel } from "@/features/discovery/components/filter-panel";
import { ResultsList } from "@/features/discovery/components/results-list";
import {
  SelectedPreview,
  type DetailState,
} from "@/features/discovery/components/selected-preview";
import {
  DiscoveryMap,
  hasMapPoint,
} from "@/features/discovery/map/discovery-map";

import {
  normalizeDiscoveryLocation,
  pushDiscoveryFilters,
  pushDiscoveryView,
  readDiscoveryLocation,
} from "@/features/discovery/hooks/discovery-url";

type Catalog = { summaries: DiscoverySummary[]; genres: Genre[] };
type FilterGroup = "when" | "where" | "genre" | "more";
export function Discovery({
  apexHref,
  initialCatalog,
  initialFilters,
  initialError,
  initialQuery,
  initialNow,
  initialView,
}: Readonly<{
  apexHref: string;
  initialCatalog: Catalog;
  initialFilters: Filters;
  initialError: string | null;
  initialQuery: string;
  initialNow: string;
  initialView: "map" | "list";
}>) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [applied, setApplied] = useState(initialFilters);
  const [pending, setPending] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [urlError, setUrlError] = useState(initialError);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const invalidUrl = urlError !== null;
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState<FilterGroup | null>(null);
  const [view, setView] = useState<"map" | "list">(initialView);
  const [detailState, setDetailState] = useState<DetailState>({
    status: "idle",
  });
  const selectedId = detailState.status === "idle" ? null : detailState.id;
  const detailRequest = useRef(0);
  const detailOrigin = useRef<HTMLElement | null>(null);
  const detailPanel = useRef<HTMLElement>(null);
  const today = new Date(initialNow);
  const panelButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(0);
  const countries = [...new Set(catalog.summaries.map((s) => s.countryCode))];
  // These are uppercase ISO codes, so code-unit order is intentional.
  // eslint-disable-next-line sonarjs/no-alphabetical-sort
  countries.sort();
  useEffect(() => {
    if (!initialError) {
      normalizeDiscoveryLocation(initialQuery);
    }
  }, [initialError, initialQuery]);
  useEffect(() => {
    const restore = () => {
      const { view, filters, error } = readDiscoveryLocation(catalog.genres);
      setView(view);
      if (filters) {
        setApplied(filters);
        setPending(filters);
        setQuery(filters.q);
      }
      setUrlError(error);
      setFormError(null);
      setSearchError(null);
      setPanel(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [catalog.genres]);
  const load = useCallback(() => {
    const request = ++latest.current;
    return fetch("/api/discovery", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Discovery is unavailable.");
        }
        return response.json() as Promise<Catalog>;
      })
      .then((next) => {
        if (request !== latest.current) {
          return;
        }
        setCatalog(next);
        setLoadError(false);
      })
      .catch(() => {
        if (request === latest.current) {
          setLoadError(true);
        }
      });
  }, []);
  useEffect(() => {
    const catalogRequests = latest;
    const detailRequests = detailRequest;
    void load();
    return () => {
      ++catalogRequests.current;
      ++detailRequests.current;
    };
  }, [load]);
  useEffect(() => {
    if (selectedId) {
      detailPanel.current?.querySelector("button")?.focus();
    }
  }, [selectedId]);
  useEffect(() => {
    if (panel) {
      document
        .querySelector<HTMLElement>("#filter-panel input, #filter-panel button")
        ?.focus();
    }
  }, [panel]);
  function closePanel() {
    setPending(applied);
    setPanel(null);
    setFormError(null);
    requestAnimationFrame(() => panelButton.current?.focus());
  }
  function openPanel(group: FilterGroup, opener: HTMLButtonElement) {
    if (panel === group) {
      closePanel();
      return;
    }
    panelButton.current = opener;
    setPending(applied);
    setFormError(null);
    setPanel(group);
  }
  function apply(next: Filters, source: "search" | "filters" = "filters") {
    if (source === "search") {
      setPanel(null);
      setPending(applied);
      setFormError(null);
    }
    try {
      const valid = normalizeFilters(next, catalog.genres);
      pushDiscoveryFilters(valid);
      setApplied(valid);
      setPending(valid);
      setQuery(valid.q);
      setUrlError(null);
      setFormError(null);
      setSearchError(null);
      setPanel(null);
      if (panel && source === "filters") {
        requestAnimationFrame(() => panelButton.current?.focus());
      }
    } catch (caught) {
      const setError = source === "search" ? setSearchError : setFormError;
      setError(caught instanceof Error ? caught.message : "Invalid filters.");
    }
  }
  function switchView(next: "map" | "list") {
    setView(next);
    pushDiscoveryView(next);
  }
  async function selectEdition(id: string) {
    if (
      selectedId !== id &&
      document.activeElement instanceof HTMLElement &&
      !detailPanel.current?.contains(document.activeElement)
    ) {
      detailOrigin.current = document.activeElement;
    }
    const request = ++detailRequest.current;
    setDetailState({ status: "loading", id });
    try {
      const response = await fetch(`/api/discovery/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Detail unavailable");
      }
      const next = (await response.json()) as PublicOccurrence;
      if (request === detailRequest.current) {
        setDetailState({ status: "ready", id, data: next });
      }
    } catch {
      if (request === detailRequest.current) {
        setDetailState({ status: "error", id });
      }
    }
  }
  function closeDetail() {
    ++detailRequest.current;
    setDetailState({ status: "idle" });
    requestAnimationFrame(() => {
      if (detailOrigin.current?.getClientRects().length) {
        detailOrigin.current.focus();
      } else {
        document
          .querySelector<HTMLElement>(".view-switch [aria-pressed=true]")
          ?.focus();
      }
    });
  }
  useEffect(() => {
    if (!panel && !selectedId) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (panel) {
        closePanel();
      } else {
        closeDetail();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
    // closePanel always uses the applied filters at the moment the panel opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, applied, selectedId]);
  const results = invalidUrl
    ? []
    : filterSummaries(catalog.summaries, applied, catalog.genres, today);
  const editionLabel = results.length === 1 ? "edition" : "editions";
  const mapped = results.filter(hasMapPoint).length;
  const active = [
    applied.q && ["Name", "q"],
    applied.from && ["When", "date"],
    (applied.countries.length || applied.place) && ["Where", "where"],
    applied.genres.length && ["Music genre", "genre"],
    (applied.durationMin !== null || applied.durationMax !== null) && [
      "Duration",
      "duration",
    ],
    applied.sizes.length && ["Size", "size"],
  ].filter(Boolean) as string[][];
  function remove(group: string) {
    const next = { ...applied };
    if (group === "q") {
      next.q = "";
    }
    if (group === "date") {
      next.from = "";
      next.to = "";
    }
    if (group === "where") {
      next.countries = [];
      next.place = "";
    }
    if (group === "genre") {
      next.genres = [];
    }
    if (group === "duration") {
      next.durationMin = null;
      next.durationMax = null;
    }
    if (group === "size") {
      next.sizes = [];
    }
    apply(next);
  }
  const secondaryGroups =
    Number(applied.durationMin !== null || applied.durationMax !== null) +
    Number(Boolean(applied.sizes.length));
  return (
    <div className="discovery">
      <header className="discovery-header">
        <a
          className="discovery-brand"
          href={apexHref}
          aria-label="Eventroam home"
        >
          event<span>roam</span>
        </a>
        <span className="discovery-scope">Festivals</span>
        <form
          className="name-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ ...applied, q: query }, "search");
          }}
        >
          <label className="sr-only" htmlFor="name-search">
            Search festival names
          </label>
          <input
            id="name-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError(null);
            }}
            aria-invalid={searchError ? true : undefined}
            aria-describedby={searchError ? "search-error" : undefined}
            placeholder="Find a festival…"
          />
          <button type="submit" aria-label="Search festival names">
            ⌕
          </button>
        </form>
      </header>
      <div className="discovery-stage">
        <div
          className="filter-toolbar"
          role="group"
          aria-label="Discovery filters"
        >
          {(["when", "where", "genre", "more"] as FilterGroup[]).map(
            (group) => (
              <button
                key={group}
                className={`filter-trigger filter-trigger-${group}`}
                type="button"
                aria-expanded={panel === group}
                aria-controls="filter-panel"
                onClick={(event) => openPanel(group, event.currentTarget)}
              >
                {group === "when" && "When"}
                {group === "where" && "Where"}
                {group === "genre" && "Music genre"}
                {group === "more" && (
                  <>
                    <span className="desktop-filter-label">More filters</span>
                    <span className="mobile-filter-label">Filters</span>
                    <span className="desktop-filter-label">
                      {secondaryGroups > 0 && ` · ${secondaryGroups}`}
                    </span>
                    <span className="mobile-filter-label">
                      {secondaryGroups +
                        Number(Boolean(applied.genres.length)) >
                        0 &&
                        ` · ${secondaryGroups + Number(Boolean(applied.genres.length))}`}
                    </span>
                  </>
                )}
              </button>
            ),
          )}
        </div>
        {panel && (
          <FilterPanel
            group={panel}
            pending={pending}
            setPending={setPending}
            countries={countries}
            summaries={catalog.summaries}
            genres={catalog.genres}
            onApply={apply}
            onCancel={closePanel}
            error={formError}
          />
        )}
        <div className={`discovery-results-shell view-${view}`}>
          <div className="list-column">
            <div className="results-summary">
              <strong aria-live="polite">
                {invalidUrl
                  ? "Invalid filters"
                  : `${results.length} ${editionLabel}`}
              </strong>
              <span className="results-geography">
                {mapped} mapped · {results.length - mapped} unlocated
              </span>
              {active.length > 0 && (
                <div className="chips" aria-label="Applied filters">
                  {active.map(([label, key]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => remove(key)}
                      aria-label={`Remove ${label} filter`}
                    >
                      {label} ×
                    </button>
                  ))}
                </div>
              )}
              <button
                className="clear-filters"
                type="button"
                onClick={() => apply(emptyFilters())}
              >
                Clear all
              </button>
            </div>
            {(urlError || loadError || searchError) && (
              <div className="discovery-notices">
                {searchError && (
                  <div id="search-error" className="notice" role="alert">
                    <p>{searchError}</p>
                  </div>
                )}
                {urlError && (
                  <div className="notice" role="alert">
                    <p>{urlError}</p>
                    <button type="button" onClick={() => apply(emptyFilters())}>
                      Reset invalid filters
                    </button>
                  </div>
                )}
                {loadError && (
                  <div className="notice" role="alert">
                    <p>
                      Could not refresh discovery results. Showing the last
                      available list.
                    </p>
                    <button type="button" onClick={() => void load()}>
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
            <ResultsList
              results={results}
              selectedId={selectedId}
              error={urlError}
              onSelect={(id) => void selectEdition(id)}
              onClear={() => apply(emptyFilters())}
            />
          </div>
          <section className="map-region" aria-label="Map results">
            <DiscoveryMap
              summaries={results}
              selectedId={selectedId}
              onSelect={(id) => void selectEdition(id)}
              visible={view === "map"}
            />
            <div className="map-result-count" aria-live="polite">
              {mapped} on map · {results.length - mapped} without a map location
            </div>
          </section>
          <SelectedPreview
            detailState={detailState}
            panelRef={detailPanel}
            onClose={closeDetail}
            onRetry={(id) => void selectEdition(id)}
          />
        </div>
        <div className="view-switch" role="group" aria-label="Discovery view">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => switchView("list")}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => switchView("map")}
          >
            Map
          </button>
        </div>
      </div>
    </div>
  );
}

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
function countGroups(f: Filters) {
  return (
    Number(Boolean(f.from)) +
    Number(Boolean(f.countries.length || f.place)) +
    Number(Boolean(f.genres.length)) +
    Number(f.durationMin !== null || f.durationMax !== null) +
    Number(Boolean(f.sizes.length))
  );
}
export function Discovery({
  initialCatalog,
  initialFilters,
  initialError,
  initialQuery,
  initialNow,
  initialView,
}: {
  initialCatalog: Catalog;
  initialFilters: Filters;
  initialError: string | null;
  initialQuery: string;
  initialNow: string;
  initialView: "map" | "list";
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [applied, setApplied] = useState(initialFilters);
  const [pending, setPending] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [urlError, setUrlError] = useState(initialError);
  const [formError, setFormError] = useState<string | null>(null);
  const invalidUrl = urlError !== null;
  const error = urlError ?? formError;
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState(false);
  const [view, setView] = useState<"map" | "list">(initialView);
  const [detailState, setDetailState] = useState<DetailState>({
    status: "idle",
  });
  const selectedId = detailState.status === "idle" ? null : detailState.id;
  const detailRequest = useRef(0);
  const detailPanel = useRef<HTMLElement>(null);
  const today = new Date(initialNow);
  const panelButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(0);
  const countries = [
    ...new Set(catalog.summaries.map((s) => s.countryCode)),
  ].sort();
  useEffect(() => {
    if (!initialError) normalizeDiscoveryLocation(initialQuery);
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
      setPanel(false);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [catalog.genres]);
  const load = useCallback(() => {
    const request = ++latest.current;
    return fetch("/api/discovery", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Discovery is unavailable.");
        return response.json() as Promise<Catalog>;
      })
      .then((next) => {
        if (request !== latest.current) return;
        setCatalog(next);
        setLoadError(false);
      })
      .catch(() => {
        if (request === latest.current) setLoadError(true);
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
    if (selectedId) detailPanel.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  function apply(next: Filters) {
    try {
      const valid = normalizeFilters(next, catalog.genres);
      pushDiscoveryFilters(valid);
      setApplied(valid);
      setPending(valid);
      setQuery(valid.q);
      setUrlError(null);
      setFormError(null);
      setPanel(false);
      panelButton.current?.focus();
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Invalid filters.",
      );
    }
  }
  function switchView(next: "map" | "list") {
    setView(next);
    pushDiscoveryView(next);
  }
  async function selectEdition(id: string) {
    const request = ++detailRequest.current;
    setDetailState({ status: "loading", id });
    try {
      const response = await fetch(`/api/discovery/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Detail unavailable");
      const next = (await response.json()) as PublicOccurrence;
      if (request === detailRequest.current)
        setDetailState({ status: "ready", id, data: next });
    } catch {
      if (request === detailRequest.current)
        setDetailState({ status: "error", id });
    }
  }
  const results = invalidUrl
    ? []
    : filterSummaries(catalog.summaries, applied, catalog.genres, today);
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
    if (group === "q") next.q = "";
    if (group === "date") {
      next.from = "";
      next.to = "";
    }
    if (group === "where") {
      next.countries = [];
      next.place = "";
    }
    if (group === "genre") next.genres = [];
    if (group === "duration") {
      next.durationMin = null;
      next.durationMax = null;
    }
    if (group === "size") next.sizes = [];
    apply(next);
  }
  return (
    <div className="discovery">
      <form
        className="name-search"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...applied, q: query });
        }}
      >
        <label htmlFor="name-search">Search by name</label>
        <div>
          <input
            id="name-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Festival name"
          />
          <button type="submit">Search</button>
        </div>
      </form>
      <div className="filter-toolbar">
        <div className="primary-filters">
          {["When", "Where", "Music genre"].map((label) => (
            <button
              key={label}
              className={label === "Music genre" ? "genre-shortcut" : ""}
              type="button"
              onClick={() => {
                setPending(applied);
                setPanel(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          ref={panelButton}
          type="button"
          aria-expanded={panel}
          aria-controls="filter-panel"
          onClick={() => {
            setPending(applied);
            setPanel(!panel);
          }}
        >
          <span className="desktop-filter-label">More filters</span>
          <span className="mobile-filter-label">Filters</span> (
          {countGroups(applied)})
        </button>
        <span aria-live="polite">
          {invalidUrl
            ? "Invalid filters"
            : `${results.length} ${results.length === 1 ? "edition" : "editions"} · ${mapped} mapped · ${results.length - mapped} unlocated`}
        </span>
        <button type="button" onClick={() => apply(emptyFilters())}>
          Clear all
        </button>
      </div>
      {panel && (
        <FilterPanel
          pending={pending}
          setPending={setPending}
          countries={countries}
          summaries={catalog.summaries}
          genres={catalog.genres}
          onApply={apply}
          onCancel={() => {
            setPending(applied);
            setPanel(false);
            setFormError(null);
            panelButton.current?.focus();
          }}
        />
      )}
      {active.length > 0 && (
        <div className="chips" aria-label="Applied filters">
          {active.map(([label, key]) => (
            <button type="button" key={key} onClick={() => remove(key)}>
              {label} ×
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => apply(emptyFilters())}>
            Reset invalid filters
          </button>
        </div>
      )}
      {loadError && (
        <div className="notice" role="alert">
          <p>
            Could not refresh discovery results. Showing the last available
            list.
          </p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      <div className="view-switch" role="group" aria-label="Discovery view">
        <button
          type="button"
          aria-pressed={view === "map"}
          onClick={() => switchView("map")}
        >
          Map
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => switchView("list")}
        >
          List
        </button>
      </div>
      <div className={`discovery-results view-${view}`}>
        <section className="map-region" aria-label="Map results">
          <h2>Map</h2>
          <DiscoveryMap
            summaries={results}
            selectedId={selectedId}
            onSelect={(id) => void selectEdition(id)}
            visible={view === "map"}
          />
        </section>
        <ResultsList
          results={results}
          selectedId={selectedId}
          error={error}
          onSelect={(id) => void selectEdition(id)}
          onClear={() => apply(emptyFilters())}
        />
      </div>
      <SelectedPreview
        detailState={detailState}
        panelRef={detailPanel}
        onClose={() => {
          ++detailRequest.current;
          setDetailState({ status: "idle" });
        }}
        onRetry={(id) => void selectEdition(id)}
      />
    </div>
  );
}

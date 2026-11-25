"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { DiscoveryNotices } from "./components/discovery-notices";
import {
  DiscoveryResults,
  ResultsStatus,
} from "./components/discovery-results";
import { DiscoveryToolbar } from "./components/discovery-toolbar";
import { FilterPanel } from "./components/filter-panel";
import { MonthStrip } from "./components/month-strip";
import type { DiscoveryView } from "./hooks/discovery-url";
import {
  useDiscoveryCatalog,
  type DiscoveryCatalog,
} from "./hooks/use-discovery-catalog";
import { useDiscoveryFilters } from "./hooks/use-discovery-filters";
import { useDiscoveryVisit } from "./hooks/use-discovery-visit";
import { useSelectedEdition } from "./hooks/use-selected-edition";
import { filterSummaries, type Filters } from "./model/discovery";
import { previewFilters } from "./model/filter-feedback";
import { filterMapArea, type MapArea } from "./model/map-area";

const searchErrorId = "search-error";

export function Discovery({
  apexHref,
  festivalsHref,
  initialCatalog,
  initialFilters,
  initialError,
  initialNow,
  initialView,
}: Readonly<{
  apexHref: string;
  festivalsHref: string;
  initialCatalog: DiscoveryCatalog;
  initialFilters: Filters;
  initialError: string | null;
  initialNow: string;
  initialView: DiscoveryView;
}>) {
  const { catalog, loadError, retry } = useDiscoveryCatalog(initialCatalog);
  const today = useMemo(() => new Date(initialNow), [initialNow]);
  const filters = useDiscoveryFilters({
    initialFilters,
    initialError,
    catalog,
    today,
  });
  const { applied, pending, panel, urlError } = filters;
  const invalidUrl = urlError !== null;
  const viewToggle = useRef<HTMLButtonElement>(null);
  const selection = useSelectedEdition(() => viewToggle.current);
  const { selectedId } = selection;
  const visit = useDiscoveryVisit({
    initialView,
    applied,
    genres: catalog.genres,
    selectedId,
    restoreFilters: filters.restore,
    restoreSelection(id, restoredFilters) {
      const eligible = restoredFilters
        ? filterSummaries(
            catalog.summaries,
            restoredFilters,
            catalog.genres,
            today,
          )
        : [];
      if (id && eligible.some((item) => item.id === id)) {
        void selection.select(id);
      } else if (selectedId) {
        selection.close();
      }
    },
  });

  const [mapArea, setMapArea] = useState<MapArea | null>(null);
  const activeArea = visit.followMap ? mapArea : null;
  const results = useMemo(
    () =>
      invalidUrl
        ? []
        : filterSummaries(catalog.summaries, applied, catalog.genres, today),
    [invalidUrl, catalog.summaries, applied, catalog.genres, today],
  );
  const listResults = activeArea ? filterMapArea(results, activeArea) : results;
  const preview = useMemo(() => {
    if (!panel) {
      return null;
    }
    const summaries = activeArea
      ? filterMapArea(catalog.summaries, activeArea)
      : catalog.summaries;
    return previewFilters(summaries, pending, catalog.genres, today);
  }, [panel, activeArea, catalog.summaries, pending, catalog.genres, today]);
  const countries = [...new Set(catalog.summaries.map((s) => s.countryCode))];
  // Sort the uppercase ISO codes in code-unit order.
  // eslint-disable-next-line sonarjs/no-alphabetical-sort
  countries.sort();

  const closeOnEscape = useEffectEvent(() => {
    if (panel) {
      filters.closePanel();
    } else {
      selection.close();
    }
  });
  useEffect(() => {
    if (!panel && !selectedId) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        closeOnEscape();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [panel, selectedId]);

  const selectedEligible =
    !selectedId || results.some((item) => item.id === selectedId);
  const clearIneligibleSelection = useEffectEvent(() =>
    selection.close({
      restoreFocus:
        selection.panelRef.current?.contains(document.activeElement) ?? false,
    }),
  );
  useEffect(() => {
    if (!selectedEligible) {
      clearIneligibleSelection();
    }
  }, [selectedEligible]);

  function selectResult(id: string, source: "list" | "map") {
    visit.saveAndKeepListScroll();
    posthog.capture("edition_details_selected", { selection_source: source });
    visit.setPreserveSelectionCamera(false);
    void selection.select(id);
  }

  const clearFilters = () => filters.clear(visit.pushFilters);

  return (
    <div className="discovery">
      <header className="discovery-header">
        <a
          className="discovery-brand"
          href={festivalsHref}
          aria-label="Eventroam festivals"
        >
          Eventroam<span aria-hidden="true">.</span>
        </a>
        <span className="discovery-scope">Festivals</span>
      </header>
      <div className="discovery-stage">
        <DiscoveryToolbar
          applied={applied}
          genres={catalog.genres}
          panel={panel}
          query={filters.query}
          searchError={filters.searchError}
          searchErrorId={searchErrorId}
          triggers={filters.triggers}
          onQueryChange={filters.changeQuery}
          onSearch={() => filters.search(visit.pushFilters)}
          onOpenPanel={filters.openPanel}
          onClear={clearFilters}
        />
        {panel && (
          <FilterPanel
            group={panel}
            onGroupChange={filters.setPanel}
            pending={pending}
            setPending={filters.setPending}
            countries={countries}
            summaries={catalog.summaries}
            genres={catalog.genres}
            onApply={(next) => filters.apply(next, visit.pushFilters)}
            onCancel={filters.closePanel}
            error={preview?.error ?? filters.formError}
            previewCount={preview?.count ?? null}
          />
        )}
        <div className="discovery-months">
          <MonthStrip
            now={visit.visitReady ? new Date() : null}
            from={applied.from}
            to={applied.to}
            onChange={(from, to) =>
              filters.apply(
                { ...applied, from, to },
                visit.pushFilters,
                "months",
              )
            }
          />
        </div>
        <DiscoveryResults
          results={results}
          listResults={listResults}
          activeArea={activeArea}
          mapArea={mapArea}
          onAreaChange={setMapArea}
          viewToggle={viewToggle}
          selection={selection}
          visit={visit}
          onSelect={selectResult}
          onClear={clearFilters}
          urlError={urlError}
          notices={
            <DiscoveryNotices
              searchError={filters.searchError}
              searchErrorId={searchErrorId}
              urlError={urlError}
              loadError={loadError}
              onClear={clearFilters}
              onRetry={retry}
            />
          }
          today={today}
        />
      </div>
      <footer className="discovery-footer">
        <ResultsStatus
          results={listResults}
          activeArea={activeArea}
          invalidUrl={invalidUrl}
        />
        <a href="/privacy">Privacy policy</a>
        <a href={apexHref}>About project</a>
      </footer>
    </div>
  );
}

import type { ReactNode, RefObject } from "react";
import { Icon } from "@/components/catalog/icons";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import { DiscoveryMap, hasMapPoint } from "../map/discovery-map";
import type { MapArea } from "../model/map-area";
import type { useDiscoveryVisit } from "../hooks/use-discovery-visit";
import type { useSelectedEdition } from "../hooks/use-selected-edition";
import { ResultsList } from "./results-list";
import { SelectedPreview } from "./selected-preview";

type ResultsVisit = Pick<
  ReturnType<typeof useDiscoveryVisit>,
  | "view"
  | "switchView"
  | "visitReady"
  | "followMap"
  | "setFollowMap"
  | "restoreCamera"
  | "preserveSelectionCamera"
  | "setPreserveSelectionCamera"
  | "changeCamera"
  | "listColumn"
  | "saveContext"
>;

export function DiscoveryResults({
  results,
  listResults,
  activeArea,
  mapArea,
  onAreaChange,
  viewToggle,
  selection,
  visit,
  onSelect,
  onClear,
  urlError,
  notices,
  today,
}: Readonly<{
  results: DiscoverySummary[];
  listResults: DiscoverySummary[];
  activeArea: MapArea | null;
  mapArea: MapArea | null;
  onAreaChange: (area: MapArea | null) => void;
  viewToggle: RefObject<HTMLButtonElement | null>;
  selection: ReturnType<typeof useSelectedEdition>;
  visit: ResultsVisit;
  onSelect: (id: string, source: "list" | "map") => void;
  onClear: () => void;
  urlError: string | null;
  notices: ReactNode;
  today: Date;
}>) {
  const { view, followMap, listColumn } = visit;
  const { selectedId, panelRef } = selection;
  return (
    <div
      className={`discovery-results-shell view-${view}`}
      data-selected={selectedId !== null}
    >
      <div className="results-panel">
        <div className="results-heading">
          <h1>
            {listResults.length}{" "}
            {listResults.length === 1 ? "festival" : "festivals"}
            {activeArea && <span className="results-area"> in map area</span>}
          </h1>
          <button
            ref={viewToggle}
            type="button"
            className="sheet-toggle"
            aria-expanded={view === "list"}
            aria-controls="festival-results"
            onClick={() => visit.switchView(view === "list" ? "map" : "list")}
          >
            {view === "list" ? "Show map" : "Expand list"}
            <Icon name={view === "list" ? "chevron-down" : "chevron-up"} />
          </button>
          <p>Select a festival to show it on the map.</p>
          <label className="follow-map">
            <input
              type="checkbox"
              checked={followMap}
              disabled={mapArea === null}
              onChange={(event) => visit.setFollowMap(event.target.checked)}
              aria-describedby="follow-map-help"
            />
            Follow map
          </label>
          <span id="follow-map-help" className="sr-only">
            Limit the list to the map area. Turn off to include events without
            map locations.
          </span>
        </div>
        <div
          id="festival-results"
          className="list-column"
          ref={listColumn}
          onScroll={visit.saveContext}
        >
          {notices}
          <ResultsList
            results={listResults}
            areaEmpty={Boolean(activeArea) && results.length > 0}
            selectedId={selectedId}
            error={urlError}
            onSelect={(id) => onSelect(id, "list")}
            onClear={onClear}
          />
        </div>
      </div>
      <section className="map-region" aria-label="Map results">
        {visit.visitReady && (
          <DiscoveryMap
            summaries={results}
            selectedId={selectedId}
            onSelect={(id) => onSelect(id, "map")}
            cardRef={panelRef}
            restoreCamera={visit.restoreCamera}
            preserveSelectionCamera={visit.preserveSelectionCamera}
            onCameraInteraction={() => visit.setPreserveSelectionCamera(true)}
            followMap={followMap}
            onAreaChange={onAreaChange}
            onCameraChange={visit.changeCamera}
          />
        )}
      </section>
      <SelectedPreview
        key={selectedId}
        detailState={selection.state}
        panelRef={panelRef}
        onClose={selection.close}
        onRetry={(id) => void selection.select(id)}
        now={today}
      />
    </div>
  );
}

export function ResultsStatus({
  results,
  activeArea,
  invalidUrl,
}: Readonly<{
  results: DiscoverySummary[];
  activeArea: MapArea | null;
  invalidUrl: boolean;
}>) {
  const eventLabel = results.length === 1 ? "event" : "events";
  const status = `${results.length} ${eventLabel}${activeArea ? " in map area" : ""}`;
  const mapped = results.filter(hasMapPoint).length;
  return (
    <div className="results-status" role="status" aria-live="polite">
      <span className="results-count">
        {invalidUrl ? "Invalid filters" : status}
      </span>
      {results.length > 0 && (
        <span className="results-geography">
          On map: {mapped} ·{" "}
          <span title="Map location unavailable">Not mapped</span>:{" "}
          {results.length - mapped}
        </span>
      )}
    </div>
  );
}

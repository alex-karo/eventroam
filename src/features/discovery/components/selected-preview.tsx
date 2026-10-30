import { DateBlock } from "@/components/catalog/date-block";
import type { RefObject } from "react";
import type { DetailState } from "@/features/discovery/hooks/use-selected-edition";
import { editionPath } from "@/site/site";
import { withDiscovery } from "@/site/discovery-context";
import { isPastEdition } from "@/catalog/domain/dates";
import {
  Dates,
  Location,
  Status,
  TicketPrice,
  Terms,
  Size,
} from "@/components/catalog/catalog";
import { Icon } from "@/components/catalog/icons";
import { ExternalLinks } from "@/components/catalog/external-links";
export function SelectedPreview({
  detailState,
  panelRef,
  onClose,
  onRetry,
  expanded,
  onExpand,
  token,
  onNavigate,
  now,
}: Readonly<{
  detailState: DetailState;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRetry: (id: string) => void;
  expanded: boolean;
  onExpand: () => void;
  token: string | null;
  onNavigate: () => void;
  now: Date;
}>) {
  if (detailState.status === "idle") {
    return null;
  }
  const selectedId = detailState.id;
  const detail = detailState.status === "ready" ? detailState.data : null;
  const path = detail
    ? withDiscovery(editionPath(detail.eventSlug, detail.key), token)
    : "";
  return (
    <section
      ref={panelRef}
      className={`detail-panel${expanded ? " is-expanded" : ""}`}
      aria-live="polite"
      aria-label="Selected edition details"
    >
      <header className="card-header">
        <h2>
          {detail ? (
            <a href={path} onClick={onNavigate}>
              {detail.eventName}
            </a>
          ) : (
            "Edition details"
          )}
        </h2>
        <div className="card-controls">
          <button
            type="button"
            className="card-expand"
            aria-label={expanded ? "Collapse details" : "Expand details"}
            title={expanded ? "Collapse details" : "Expand details"}
            aria-expanded={expanded}
            aria-controls="selected-more"
            onClick={onExpand}
          >
            <Icon name={expanded ? "chevron-down" : "chevron-up"} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            title="Close details"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="card-scroll">
        {detailState.status === "loading" && <p>Loading edition details…</p>}
        {detailState.status === "error" && (
          <div role="alert">
            <p>Could not load edition details.</p>
            <button type="button" onClick={() => onRetry(selectedId)}>
              Retry details
            </button>
          </div>
        )}
        {detail && (
          <>
            <div className="preview-date">
              <DateBlock date={detail.startsOn} />
              <div className="card-date-facts">
                <Dates edition={detail} />
                <Status edition={detail} now={now} />
              </div>
            </div>
            <Location edition={detail} />
            <div id="selected-more" className="selected-more">
              <Terms edition={detail} />
              <Size edition={detail} />
              <TicketPrice edition={detail} now={now} />
              <ExternalLinks
                links={detail.links}
                historicalYear={
                  isPastEdition(detail, now) ? detail.year : undefined
                }
              />
            </div>
          </>
        )}
      </div>
      {detail && (
        <footer className="card-footer">
          <a className="view-edition" href={path} onClick={onNavigate}>
            View <Icon name="arrow-right" />
          </a>
        </footer>
      )}
    </section>
  );
}

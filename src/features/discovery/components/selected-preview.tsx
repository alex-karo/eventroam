import { DateBlock } from "@/components/catalog/date-block";
import { useState, type RefObject } from "react";
import type { DetailState } from "@/features/discovery/hooks/use-selected-edition";
import { editionPath } from "@/site/site";
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
  now,
}: Readonly<{
  detailState: DetailState;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRetry: (id: string) => void;
  now: Date;
}>) {
  const [expanded, setExpanded] = useState(false);
  if (detailState.status === "idle") {
    return null;
  }
  const selectedId = detailState.id;
  const detail = detailState.status === "ready" ? detailState.data : null;
  const path = detail ? editionPath(detail.eventSlug, detail.key) : "";
  return (
    <section
      ref={panelRef}
      className="detail-panel"
      data-expanded={expanded}
      aria-live="polite"
      aria-label="Selected edition details"
    >
      <header className="card-header">
        <h2>
          {detail ? (
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              title="Open festival page in a new tab"
            >
              {detail.eventName}
            </a>
          ) : (
            "Edition details"
          )}
        </h2>
        <div className="card-controls">
          <button
            className="card-expand"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="selected-edition-more"
            aria-label={expanded ? "Collapse details" : "Expand details"}
            title={expanded ? "Collapse details" : "Expand details"}
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
          </>
        )}
        <div id="selected-edition-more" className="card-more">
          {detail && (
            <>
              <Terms edition={detail} />
              <Size edition={detail} />
              <TicketPrice edition={detail} now={now} />
              <ExternalLinks
                links={detail.links}
                historicalYear={
                  isPastEdition(detail, now) ? detail.year : undefined
                }
              />
            </>
          )}
        </div>
      </div>
      {detail && (
        <footer className="card-footer">
          <a
            className="view-edition"
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            title="Open festival page in a new tab"
          >
            Open page <Icon name="new-page" />
          </a>
        </footer>
      )}
    </section>
  );
}

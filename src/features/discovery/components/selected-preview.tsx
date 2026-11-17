import { useState, type RefObject } from "react";
import type { PublicEdition } from "@/catalog/read/contracts";
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

function previewLinks(links: PublicEdition["links"]) {
  const selected: PublicEdition["links"] = [];
  for (const kind of [
    "official_site",
    "ticketing",
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "x",
  ]) {
    const link = links.find(
      (link) =>
        link.kind === kind && !selected.some(({ url }) => url === link.url),
    );
    if (link) {
      selected.push(link);
    }
    if (selected.length === 3) {
      break;
    }
  }
  return selected;
}

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
  const description = detail?.shortDescription?.trim();
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
      <div id="selected-edition-more" className="card-scroll">
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
            <Terms
              terms={detail.terms.filter(({ facet }) => facet === "genre")}
            />
            <div className="preview-facts">
              <div className="preview-date">
                <Dates edition={detail} />
                {(detail.status !== "scheduled" ||
                  isPastEdition(detail, now)) && (
                  <Status edition={detail} now={now} />
                )}
              </div>
              <Location edition={detail} compact />
              <Size edition={detail} showLabel={false} />
              <div className="card-more">
                <TicketPrice edition={detail} now={now} />
              </div>
            </div>
            {description && <p className="preview-summary">{description}</p>}
          </>
        )}
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
            View festival <Icon name="new-page" />
          </a>
          <ExternalLinks
            links={previewLinks(detail.links)}
            iconsOnly
            historicalYear={
              isPastEdition(detail, now) ? detail.year : undefined
            }
          />
        </footer>
      )}
    </section>
  );
}

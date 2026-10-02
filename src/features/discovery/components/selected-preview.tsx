import type { RefObject } from "react";
import type { PublicOccurrence } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";
import {
  Dates,
  Location,
  Status,
  TicketPrice,
} from "@/components/catalog/catalog";

export type DetailState =
  | { status: "idle" }
  | { status: "loading" | "error"; id: string }
  | { status: "ready"; id: string; data: PublicOccurrence };

export function SelectedPreview({
  detailState,
  panelRef,
  onClose,
  onRetry,
}: {
  detailState: DetailState;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRetry: (id: string) => void;
}) {
  if (detailState.status === "idle") return null;
  const selectedId = detailState.id;
  const detail = detailState.status === "ready" ? detailState.data : null;
  return (
    <section
      ref={panelRef}
      className="detail-panel"
      aria-live="polite"
      aria-label="Selected edition details"
    >
      <button type="button" onClick={onClose}>
        Close details
      </button>
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
          <h2>{detail.name ?? `${detail.eventName} ${detail.year}`}</h2>
          <Status edition={detail} />
          <Dates edition={detail} />
          <Location edition={detail} />
          {detail.venueAddress && <p>{detail.venueAddress}</p>}
          {detail.terms.length > 0 && (
            <p>
              Classification: {detail.terms.map((term) => term.name).join(", ")}
            </p>
          )}
          {detail.capacityEstimate !== null && (
            <p>
              Estimated capacity: {detail.capacityEstimate.toLocaleString("en")}
            </p>
          )}
          <TicketPrice edition={detail} />
          {detail.links.length > 0 && (
            <>
              <h3>Official links</h3>
              <ul>
                {detail.links.map((link) => (
                  <li key={`${link.kind}:${link.url}`}>
                    <a href={link.url} rel="noopener noreferrer">
                      {link.label ?? link.kind.replaceAll("_", " ")}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <a href={editionPath(detail.eventSlug, detail.key)}>
            Open full edition page
          </a>
        </>
      )}
    </section>
  );
}

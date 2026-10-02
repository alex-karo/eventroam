import Link from "next/link";
import type { PublicEvent, PublicOccurrence } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";
import {
  Dates,
  EditionItem,
  Location,
  Status,
} from "@/components/catalog/catalog";

export function EventDetailsPage({
  event,
  active,
}: {
  event: PublicEvent;
  active: PublicOccurrence | null;
}) {
  return (
    <main className="catalog">
      <nav>
        <Link href="/">Festivals</Link>
      </nav>
      <h1>{event.name}</h1>
      {event.summary && <p>{event.summary}</p>}
      {active ? (
        <section>
          <h2>Current edition</h2>
          <a href={editionPath(event.slug, active.key)}>
            {active.name ?? `${event.name} ${active.year}`}
          </a>
          <Dates edition={active} />
          <Status edition={active} />
          <Location edition={active} />
          {active.terms.length > 0 && (
            <p>
              Classification: {active.terms.map((term) => term.name).join(", ")}
            </p>
          )}
        </section>
      ) : (
        <p>No upcoming edition has been announced.</p>
      )}
      <section>
        <h2>Published editions and history</h2>
        <ul className="edition-list">
          {event.editions.map((edition) => (
            <EditionItem key={edition.id} edition={edition} />
          ))}
        </ul>
      </section>
    </main>
  );
}

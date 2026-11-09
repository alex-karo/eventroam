import { SiteHeader } from "@/components/site/site-header";
import type { PublicEvent, SimilarFestival } from "@/catalog/read/contracts";
import { Dates } from "@/components/catalog/catalog";
import { EditionHistory } from "@/components/catalog/edition-history";
import { placeName } from "@/components/catalog/format";
import { Icon } from "@/components/catalog/icons";
import { festivalDescription } from "@/site/festival-description";
import { editionPath } from "@/site/site";

export function EventDetailsPage({
  event,
  alternatives,
}: Readonly<{ event: PublicEvent; alternatives: SimilarFestival[] }>) {
  return (
    <>
      <SiteHeader />
      <main className="catalog festival-details">
        <h1>{event.name}</h1>
        <p>{festivalDescription(event)}</p>
        {alternatives.length > 0 && (
          <section aria-labelledby="similar-festivals-heading">
            <h2 id="similar-festivals-heading">Festivals like {event.name}</h2>
            <ul className="similar-festivals">
              {alternatives.map(({ edition, sharedGenreName }) => (
                <li key={edition.id}>
                  <h3>
                    <a href={editionPath(edition.eventSlug, edition.key)}>
                      {edition.eventName}
                    </a>
                  </h3>
                  <Dates edition={edition} />
                  <p className="fact">
                    <Icon name="place" />
                    <span>{placeName(edition)}</span>
                  </p>
                  <p>Shared genre · {sharedGenreName}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2>Published editions and history</h2>
          <EditionHistory editions={event.editions} />
        </section>
        <footer className="privacy-footer">
          <a href="/privacy">Privacy policy</a>
        </footer>
      </main>
    </>
  );
}

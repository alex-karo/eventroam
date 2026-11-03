import { SiteHeader } from "@/components/site/site-header";
import type { PublicEvent } from "@/catalog/read/contracts";
import { EditionHistory } from "@/components/catalog/edition-history";
export function EventDetailsPage({ event }: Readonly<{ event: PublicEvent }>) {
  return (
    <>
      <SiteHeader />
      <main className="catalog festival-details">
        <h1>{event.name}</h1>
        {event.summary && <p>{event.summary}</p>}
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

import { SiteHeader } from "@/components/site/site-header";
import type { PublicEvent } from "@/catalog/read/contracts";
import { BackToResults } from "@/components/catalog/back-to-results";
import { EditionHistory } from "@/components/catalog/edition-history";
export function EventDetailsPage({
  event,
  token = null,
}: Readonly<{ event: PublicEvent; token?: string | null }>) {
  return (
    <>
      <SiteHeader />
      <main className="catalog festival-details">
        <nav>
          <BackToResults token={token} />
        </nav>
        <h1>{event.name}</h1>
        {event.summary && <p>{event.summary}</p>}
        <section>
          <h2>Published editions and history</h2>
          <EditionHistory editions={event.editions} token={token} />
        </section>
        <footer className="privacy-footer">
          <a href="/privacy">Privacy policy</a>
        </footer>
      </main>
    </>
  );
}

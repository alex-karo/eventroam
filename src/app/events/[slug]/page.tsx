import Link from "next/link";
import { requestDetail } from "@/application/public-request";
import { eventPath, editionPath } from "@/application/public-site";
import { selectActive } from "@/application/public-catalog";
import { Dates, EditionItem, Location, Status } from "@/components/catalog";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { event } = await requestDetail(eventPath(slug));
  const active = selectActive(
    event.editions,
    new Date().toISOString().slice(0, 10),
  );
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

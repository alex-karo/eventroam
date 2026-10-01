import Link from "next/link";
import { requestDetail } from "@/application/public-request";
import { eventPath, editionPath } from "@/application/public-site";
import { Dates, Location, Status, TicketPrice } from "@/components/catalog";

export default async function OccurrencePage({
  params,
}: {
  params: Promise<{ slug: string; key: string }>;
}) {
  const { slug, key } = await params;
  const { event, edition } = await requestDetail(editionPath(slug, key));
  if (!edition) return null;
  const siblings = event.editions.filter((o) => o.id !== edition.id);
  return (
    <main className="catalog">
      <nav>
        <Link href="/">Festivals</Link> /{" "}
        <a href={eventPath(event.slug)}>{event.name}</a>
      </nav>
      <h1>{edition.name ?? `${event.name} ${edition.year}`}</h1>
      <Status edition={edition} />
      <Dates edition={edition} />
      <Location edition={edition} />
      {edition.venueAddress && <p>{edition.venueAddress}</p>}
      {edition.terms.length > 0 && (
        <section>
          <h2>Classification</h2>
          <p>{edition.terms.map((term) => term.name).join(", ")}</p>
        </section>
      )}
      {edition.capacityEstimate !== null && (
        <p>
          Estimated capacity: {edition.capacityEstimate.toLocaleString("en")}
        </p>
      )}
      <TicketPrice edition={edition} />
      {edition.links.length > 0 && (
        <section>
          <h2>Official links</h2>
          <ul>
            {edition.links.map((link) => (
              <li key={`${link.kind}:${link.url}`}>
                <a href={link.url} rel="noopener noreferrer">
                  {link.label ?? link.kind.replaceAll("_", " ")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {siblings.length > 0 && (
        <section>
          <h2>Other published editions</h2>
          <ul>
            {siblings.map((s) => (
              <li key={s.id}>
                <a href={editionPath(event.slug, s.key)}>
                  {s.name ?? `${event.name} ${s.year}`}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

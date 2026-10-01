import { requestSite } from "@/application/public-request";
import { publicList } from "@/application/public-catalog";
import { openDatabase } from "@/db/connection";
import { EditionItem } from "@/components/catalog";

export default async function HomePage() {
  const { site, origins } = await requestSite();
  if (site === "apex")
    return (
      <main className="catalog">
        <h1>Eventroam</h1>
        <p>Explore events around the world.</p>
        <a href={origins.festivals}>Festivals</a>
      </main>
    );
  const { client } = openDatabase();
  let editions;
  try {
    editions = publicList(client, new Date().toISOString().slice(0, 10));
  } finally {
    client.close();
  }
  return (
    <main className="catalog">
      <nav>
        <a href={origins.apex}>Eventroam</a> / Festivals
      </nav>
      <h1>Festivals</h1>
      <p>Upcoming and ongoing festivals and gatherings.</p>
      {editions.length ? (
        <ul className="edition-list">
          {editions.map((edition) => (
            <EditionItem key={edition.id} edition={edition} />
          ))}
        </ul>
      ) : (
        <p>No upcoming editions are currently listed.</p>
      )}
    </main>
  );
}

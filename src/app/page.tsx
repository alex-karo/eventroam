import type { Metadata } from "next";
import { requestSite } from "@/application/public-request";
import { discoveryCatalog, discoveryGenres } from "@/application/discovery-catalog";
import {
  emptyFilters,
  parseFilters,
  serializeFilters,
} from "@/application/discovery";
import { openDatabase } from "@/db/connection";
import { Discovery } from "@/components/discovery";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function paramsFromRecord(
  record: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  return params;
}
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { site, origins } = await requestSite();
  if (site !== "festivals") return { title: "Eventroam" };
  const params = paramsFromRecord(await searchParams);
  const { client } = openDatabase();
  let genres;
  try {
    genres = discoveryGenres(client);
  } finally {
    client.close();
  }
  try {
    const normalized = serializeFilters(
      parseFilters(params, genres),
    ).toString();
    return {
      title: "Festivals | Eventroam",
      robots: normalized ? { index: false, follow: true } : undefined,
      alternates: {
        canonical: `${origins.festivals}/${normalized ? `?${normalized}` : ""}`,
      },
    };
  } catch {
    return {
      title: "Invalid festival filters | Eventroam",
      robots: { index: false, follow: true },
    };
  }
}
export default async function HomePage({ searchParams }: Props) {
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
  let catalog;
  try {
    catalog = discoveryCatalog(client);
  } finally {
    client.close();
  }
  const raw = paramsFromRecord(await searchParams);
  let initial = emptyFilters();
  let error: string | null = null;
  try {
    initial = parseFilters(raw, catalog.genres);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Invalid filters.";
  }
  const normalized = serializeFilters(initial).toString();
  return (
    <main className="catalog discovery-page">
      <nav>
        <a href={origins.apex}>Eventroam</a> / Festivals
      </nav>
      <h1>Festivals</h1>
      <p>
        Explore upcoming and past festivals and gatherings. Date ranges include
        any overlapping edition.
      </p>
      <Discovery
        initialCatalog={catalog}
        initialFilters={initial}
        initialError={error}
        initialQuery={normalized}
        initialNow={new Date().toISOString()}
        initialView={raw.get("view") === "map" ? "map" : "list"}
      />
    </main>
  );
}

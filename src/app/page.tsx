import type { Metadata } from "next";
import { pageMetadata } from "@/site/server/metadata";
import { requestSite } from "@/site/server/public-request";
import { discoveryCatalog, discoveryGenres } from "@/catalog/read/discovery";
import {
  emptyFilters,
  parseFilters,
  serializeFilters,
} from "@/features/discovery/model/discovery";
import { openReadDatabase } from "@/db/connection";
import { Discovery } from "@/features/discovery/discovery";
import { ProjectPresentation } from "@/features/project-presentation/project-presentation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function paramsFromRecord(
  record: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      params.append(key, item);
    }
  }
  return params;
}
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { site, origins } = await requestSite();
  if (site !== "festivals") {
    return pageMetadata(
      "Eventroam | A catalog of structured data",
      "From web sources to one catalog, with agents to collect new records and update existing ones.",
      `${origins.apex}/`,
    );
  }
  const params = paramsFromRecord(await searchParams);
  const { client } = openReadDatabase();
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
    const query = normalized ? `?${normalized}` : "";
    return pageMetadata(
      "Festivals | Eventroam",
      "Find festivals by date, country, music genre, duration, and estimated size. Explore the list and map, with links to published editions.",
      `${origins.festivals}/${query}`,
      !normalized,
    );
  } catch {
    return pageMetadata(
      "Invalid festival filters | Eventroam",
      "Check the festival filters or clear them to return to festival discovery.",
      `${origins.festivals}/`,
      false,
    );
  }
}
export default async function HomePage({ searchParams }: Readonly<Props>) {
  const { site, origins } = await requestSite();
  if (site === "apex") {
    return <ProjectPresentation festivalsHref={origins.festivals} />;
  }
  const { client } = openReadDatabase();
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
  return (
    <main className="discovery-page">
      <Discovery
        apexHref={origins.apex}
        initialCatalog={catalog}
        initialFilters={initial}
        initialError={error}
        initialNow={new Date().toISOString()}
        initialView={raw.get("view") === "map" ? "map" : "list"}
      />
    </main>
  );
}

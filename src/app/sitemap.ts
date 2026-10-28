import type { MetadataRoute } from "next";
import { publicUrlRecords } from "@/catalog/read/public-catalog";
import { openReadDatabase } from "@/db/connection";
import { editionPath, eventPath } from "@/site/site";
import { requestSite } from "@/site/server/public-request";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { site, origins } = await requestSite();
  const origin = origins[site];
  if (site === "apex") {
    return [{ url: `${origin}/` }, { url: `${origin}/privacy` }];
  }
  const { client } = openReadDatabase();
  try {
    const paths = new Set(
      publicUrlRecords(client).flatMap(({ eventSlug, editionKey }) => [
        eventPath(eventSlug),
        editionPath(eventSlug, editionKey),
      ]),
    );
    return [
      { url: `${origin}/` },
      { url: `${origin}/privacy` },
      ...Array.from(paths, (path) => ({ url: `${origin}${path}` })),
    ];
  } finally {
    client.close();
  }
}

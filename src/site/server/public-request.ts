import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { openReadDatabase } from "@/db/connection";
import type { PublicEvent } from "@/catalog/read/contracts";
import { resolvePublicPath } from "@/catalog/read/public-catalog";
import { similarFestivals } from "@/catalog/read/similar-festivals";
import { siteForHost, siteOrigins, editionPath, eventPath } from "@/site/site";

export const requestNow = cache(() => new Date());

export const requestSite = cache(async () => {
  const host = (await headers()).get("host");
  const origins = siteOrigins();
  const site = siteForHost(host, origins);
  if (!site) {
    notFound();
  }
  return { site, origins };
});
export const requestDetail = cache(async (path: string) => {
  const { site, origins } = await requestSite();
  const { client } = openReadDatabase();
  let detail;
  try {
    detail = resolvePublicPath(client, path);
  } finally {
    client.close();
  }
  if (!detail) {
    notFound();
  }
  const current = detail.edition
    ? editionPath(detail.event.slug, detail.edition.key)
    : eventPath(detail.event.slug);
  if (site !== "festivals" || detail.redirect) {
    permanentRedirect(`${origins.festivals}${current}`);
  }
  return detail;
});

export function requestSimilarFestivals(event: PublicEvent) {
  const { client } = openReadDatabase();
  try {
    return similarFestivals(client, event, requestNow());
  } finally {
    client.close();
  }
}

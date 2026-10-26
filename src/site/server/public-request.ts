import "server-only";
import { withDiscovery } from "@/site/discovery-context";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { openReadDatabase } from "@/db/connection";
import { resolvePublicPath } from "@/catalog/read/public-catalog";
import { siteForHost, siteOrigins, editionPath, eventPath } from "@/site/site";

export async function requestSite() {
  const host = (await headers()).get("host");
  const origins = siteOrigins();
  const site = siteForHost(host, origins);
  if (!site) {
    notFound();
  }
  return { site, origins };
}
export async function requestDetail(path: string, token: string | null = null) {
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
    permanentRedirect(`${origins.festivals}${withDiscovery(current, token)}`);
  }
  return detail;
}

import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { openDatabase } from "@/db/connection";
import { resolvePublicPath } from "@/application/public-catalog";
import {
  siteForHost,
  siteOrigins,
  editionPath,
  eventPath,
} from "@/application/public-site";

export async function requestSite() {
  const host = (await headers()).get("host");
  const origins = siteOrigins();
  const site = siteForHost(host, origins);
  if (!site) notFound();
  return { site, origins };
}
export async function requestDetail(path: string) {
  const { site, origins } = await requestSite();
  const { client } = openDatabase();
  let detail;
  try {
    detail = resolvePublicPath(client, path);
  } finally {
    client.close();
  }
  if (!detail) notFound();
  const current = detail.edition
    ? editionPath(detail.event.slug, detail.edition.key)
    : eventPath(detail.event.slug);
  if (site !== "festivals" || detail.redirect)
    permanentRedirect(`${origins.festivals}${current}`);
  return detail;
}

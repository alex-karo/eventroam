import type { MetadataRoute } from "next";
import { requestSite } from "@/site/server/public-request";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site, origins } = await requestSite();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${origins[site]}/sitemap.xml`,
  };
}

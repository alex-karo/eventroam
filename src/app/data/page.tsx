import type { Metadata } from "next";
import { DataServicePage } from "@/features/project-presentation/project-presentation";
import { pageMetadata } from "@/site/server/metadata";
import { requestApexSite } from "@/site/server/public-request";

export async function generateMetadata(): Promise<Metadata> {
  const { origins } = await requestApexSite();
  return pageMetadata(
    "Data for your product | Eventroam",
    "Use structured festival data in a regional calendar, trip planner, or festival guide. See real edition dates, venues, and ticket terms from the Eventroam catalog.",
    `${origins.apex}/data`,
  );
}

export default async function DataPage() {
  const { origins } = await requestApexSite();
  return <DataServicePage festivalsHref={origins.festivals} />;
}

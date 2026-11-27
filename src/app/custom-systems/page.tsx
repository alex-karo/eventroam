import type { Metadata } from "next";
import { CustomSystemsPage } from "@/features/project-presentation/project-presentation";
import { pageMetadata } from "@/site/server/metadata";
import { requestApexSite } from "@/site/server/public-request";

export async function generateMetadata(): Promise<Metadata> {
  const { origins } = await requestApexSite();
  return pageMetadata(
    "Custom agent pipelines | Eventroam",
    "Build an agent pipeline to extract data from your sources, check updates against your rules, and deliver them to the tools your team uses.",
    `${origins.apex}/custom-systems`,
  );
}

export default async function CustomSystemsRoute() {
  const { origins } = await requestApexSite();
  return <CustomSystemsPage festivalsHref={origins.festivals} />;
}

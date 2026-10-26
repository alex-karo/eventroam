import { discoveryToken } from "@/site/discovery-context";
import { requestDetail } from "@/site/server/public-request";
import { editionPath } from "@/site/site";
import { EditionDetailsPage } from "@/features/event-details/edition-page";

export default async function EditionPage({
  params,
  searchParams,
}: Readonly<{
  searchParams: Promise<{ discovery?: string }>;
  params: Promise<{ slug: string; key: string }>;
}>) {
  const { slug, key } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event, edition } = await requestDetail(editionPath(slug, key), token);
  if (!edition) {
    return null;
  }
  return <EditionDetailsPage event={event} edition={edition} token={token} />;
}

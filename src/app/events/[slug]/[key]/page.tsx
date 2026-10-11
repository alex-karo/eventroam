import { requestDetail } from "@/site/server/public-request";
import { editionPath } from "@/site/site";
import { EditionDetailsPage } from "@/features/event-details/edition-page";

export default async function EditionPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string; key: string }>;
}>) {
  const { slug, key } = await params;
  const { event, edition } = await requestDetail(editionPath(slug, key));
  if (!edition) {
    return null;
  }
  return <EditionDetailsPage event={event} edition={edition} />;
}

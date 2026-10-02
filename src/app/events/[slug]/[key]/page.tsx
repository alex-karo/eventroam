import { requestDetail } from "@/site/server/public-request";
import { editionPath } from "@/site/site";
import { OccurrenceDetailsPage } from "@/features/event-details/occurrence-page";

export default async function OccurrencePage({
  params,
}: {
  params: Promise<{ slug: string; key: string }>;
}) {
  const { slug, key } = await params;
  const { event, edition } = await requestDetail(editionPath(slug, key));
  if (!edition) return null;
  return <OccurrenceDetailsPage event={event} edition={edition} />;
}

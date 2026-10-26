import { requestDetail } from "@/site/server/public-request";
import { eventPath } from "@/site/site";
import { discoveryToken } from "@/site/discovery-context";
import { EventDetailsPage } from "@/features/event-details/event-page";
export default async function EventPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ discovery?: string }>;
}>) {
  const { slug } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event } = await requestDetail(eventPath(slug), token);
  return <EventDetailsPage event={event} token={token} />;
}

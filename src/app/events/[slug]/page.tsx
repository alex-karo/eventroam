import { requestDetail } from "@/site/server/public-request";
import { eventPath } from "@/site/site";
import { selectActive } from "@/catalog/read/public-catalog";
import { EventDetailsPage } from "@/features/event-details/event-page";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { event } = await requestDetail(eventPath(slug));
  const active = selectActive(
    event.editions,
    new Date().toISOString().slice(0, 10),
  );
  return <EventDetailsPage event={event} active={active} />;
}

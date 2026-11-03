import type { Metadata } from "next";
import { eventMetadata } from "@/site/server/metadata";
import { requestDetail } from "@/site/server/public-request";
import { requestSite } from "@/site/server/public-request";
import { eventPath } from "@/site/site";
import { EventDetailsPage } from "@/features/event-details/event-page";
type Props = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await requestDetail(eventPath(slug));
  const { origins } = await requestSite();
  return eventMetadata(event, origins.festivals);
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const { event } = await requestDetail(eventPath(slug));
  return <EventDetailsPage event={event} />;
}

import type { Metadata } from "next";
import { eventMetadata } from "@/site/server/metadata";
import { requestDetail } from "@/site/server/public-request";
import { requestSite } from "@/site/server/public-request";
import { eventPath } from "@/site/site";
import { discoveryToken } from "@/site/discovery-context";
import { EventDetailsPage } from "@/features/event-details/event-page";
type Props = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ discovery?: string }>;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event } = await requestDetail(eventPath(slug), token);
  const { origins } = await requestSite();
  return eventMetadata(event, origins.festivals);
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event } = await requestDetail(eventPath(slug), token);
  return <EventDetailsPage event={event} token={token} />;
}

import type { Metadata } from "next";
import { editionMetadata } from "@/site/server/metadata";
import {
  editionStructuredData,
  serializeStructuredData,
} from "@/site/server/structured-data";
import {
  requestDetail,
  requestNow,
  requestSite,
} from "@/site/server/public-request";
import { editionPath } from "@/site/site";
import { EditionDetailsPage } from "@/features/event-details/edition-page";

type Props = Readonly<{
  params: Promise<{ slug: string; key: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, key } = await params;
  const { event, edition } = await requestDetail(editionPath(slug, key));
  const { origins } = await requestSite();
  return edition
    ? editionMetadata(event, edition, origins.festivals, requestNow())
    : {};
}

export default async function EditionPage({ params }: Props) {
  const { slug, key } = await params;
  const { event, edition } = await requestDetail(editionPath(slug, key));
  if (!edition) {
    return null;
  }
  const { origins } = await requestSite();
  const structuredData = editionStructuredData(
    event,
    edition,
    origins.festivals,
  );
  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(structuredData),
          }}
        />
      )}
      <EditionDetailsPage event={event} edition={edition} now={requestNow()} />
    </>
  );
}

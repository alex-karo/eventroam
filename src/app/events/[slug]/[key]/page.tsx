import type { Metadata } from "next";
import { editionMetadata } from "@/site/server/metadata";
import {
  editionStructuredData,
  serializeStructuredData,
} from "@/site/server/structured-data";
import { discoveryToken } from "@/site/discovery-context";
import {
  requestDetail,
  requestNow,
  requestSite,
} from "@/site/server/public-request";
import { editionPath } from "@/site/site";
import { EditionDetailsPage } from "@/features/event-details/edition-page";

type Props = Readonly<{
  searchParams: Promise<{ discovery?: string }>;
  params: Promise<{ slug: string; key: string }>;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug, key } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event, edition } = await requestDetail(editionPath(slug, key), token);
  const { origins } = await requestSite();
  return edition
    ? editionMetadata(event, edition, origins.festivals, requestNow())
    : {};
}

export default async function EditionPage({ params, searchParams }: Props) {
  const { slug, key } = await params;
  const token = discoveryToken((await searchParams).discovery);
  const { event, edition } = await requestDetail(editionPath(slug, key), token);
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
      <EditionDetailsPage
        event={event}
        edition={edition}
        token={token}
        now={requestNow()}
      />
    </>
  );
}

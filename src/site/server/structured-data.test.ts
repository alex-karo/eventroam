import { expect, test } from "vitest";
import type { PublicEdition } from "@/catalog/read/contracts";
import { publicEvent } from "@/catalog/read/public-catalog";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  editionStructuredData,
  serializeStructuredData,
} from "./structured-data";

const cases: {
  label: string;
  fields: Partial<PublicEdition>;
  status: string | null;
}[] = [
  { label: "confirmed locality", fields: {}, status: "EventScheduled" },
  {
    label: "street address and announced status",
    fields: {
      locality: null,
      venueAddress: "1 Test Road",
      status: "announced",
    },
    status: "EventScheduled",
  },
  {
    label: "provisional dates",
    fields: { dateState: "provisional" },
    status: null,
  },
  {
    label: "venue and region without address or locality",
    fields: {
      locality: null,
      venueName: "Test Field",
      administrativeArea: "Test Region",
      latitude: 38,
      longitude: -9,
    },
    status: null,
  },
  {
    label: "cancelled",
    fields: { status: "cancelled" },
    status: "EventCancelled",
  },
  {
    label: "postponed",
    fields: { status: "postponed" },
    status: "EventPostponed",
  },
];

test.each(cases)("Edition JSON-LD: $label", ({ fields, status }) => {
  const client = testDatabase().client;
  const created = testFixtures(client).publishedEvent();
  const event = publicEvent(client, created.event.id)!;
  const edition = { ...event.editions[0], ...fields };
  const data = editionStructuredData(
    event,
    edition,
    "https://festivals.eventroam.org",
  );
  if (status === null) {
    expect(data).toBeNull();
    return;
  }
  const url = `https://festivals.eventroam.org/events/${event.slug}/${edition.key}`;
  expect(data).toMatchObject({
    "@type": "Event",
    "@id": url,
    url,
    startDate: "2027-07-01",
    endDate: "2027-07-01",
    eventStatus: `https://schema.org/${status}`,
    location: { "@type": "Place", address: { addressCountry: "PT" } },
  });
  for (const field of [
    "image",
    "organizer",
    "performer",
    "offers",
    "previousStartDate",
  ]) {
    expect(data).not.toHaveProperty(field);
  }
});

test("JSON-LD text cannot close its script element", () => {
  const client = testDatabase().client;
  const text = '</script><script>alert("test")</script>';
  const created = testFixtures(client).publishedEvent({
    event: { canonicalName: text },
  });
  const event = publicEvent(client, created.event.id)!;
  const data = editionStructuredData(
    event,
    event.editions[0],
    "https://festivals.eventroam.org",
  )!;
  const serialized = serializeStructuredData(data);
  expect(serialized).not.toContain("<");
  expect(JSON.parse(serialized).name).toBe(`${text} 2027`);
});

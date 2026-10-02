import { NextResponse } from "next/server";
import { requestSite } from "@/site/server/public-request";
import { publicOccurrenceById } from "@/catalog/read/public-catalog";
import { openReadDatabase } from "@/db/connection";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { site } = await requestSite();
  if (site !== "festivals")
    return NextResponse.json({ error: "Unknown scope" }, { status: 404 });
  const { id } = await params;
  const { client } = openReadDatabase();
  try {
    const edition = publicOccurrenceById(client, id);
    if (!edition)
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    return NextResponse.json(edition, {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    client.close();
  }
}

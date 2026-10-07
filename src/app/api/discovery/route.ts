import { NextResponse } from "next/server";
import { requestSite } from "@/site/server/public-request";
import { discoveryCatalog } from "@/catalog/read/discovery";
import { openReadDatabase } from "@/db/connection";

export async function GET() {
  const { site } = await requestSite();
  if (site !== "festivals") {
    return NextResponse.json({ error: "Unknown scope" }, { status: 404 });
  }
  const { client } = openReadDatabase();
  try {
    return NextResponse.json(discoveryCatalog(client), {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    client.close();
  }
}

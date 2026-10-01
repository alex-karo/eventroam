import { NextResponse } from "next/server";
import { requestSite } from "@/application/public-request";
import { discoveryCatalog } from "@/application/discovery-catalog";
import { openDatabase } from "@/db/connection";

export async function GET() {
  const { site } = await requestSite();
  if (site !== "festivals")
    return NextResponse.json({ error: "Unknown scope" }, { status: 404 });
  const { client } = openDatabase();
  try {
    return NextResponse.json(discoveryCatalog(client), {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    client.close();
  }
}

import { catalogAvailable } from "@/catalog/read/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const available = catalogAvailable();
  return Response.json(
    { status: available ? "ok" : "unavailable" },
    { status: available ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

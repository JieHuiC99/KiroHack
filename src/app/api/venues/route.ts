import { connection, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getVenueBoard } from "@/server/venues";

export function GET() {
  return handle(async () => {
    await connection();
    return NextResponse.json(await getVenueBoard(), { headers: { "Cache-Control": "no-store" } });
  });
}

// Polled by the venue monitor: every teaching venue, the class in it now, and how it has answered the alarm.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { getVenueBoard } from "@/server/venues";

export function GET(request: Request) {
  return handle(async () => {
    await requireApiUser(request, "team"); // reading the session also makes this per-request, never cached
    return NextResponse.json(await getVenueBoard(), { headers: { "Cache-Control": "no-store" } });
  });
}

// Polled by the venue monitor: every teaching venue, the class in it now, and how it has answered the alarm.
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getVenueBoard } from "@/server/venues";

export async function GET() {
  await connection(); // never prerender or cache: this is live data
  return NextResponse.json(await getVenueBoard(), { headers: { "Cache-Control": "no-store" } });
}

// Polled every ~1.5 s by the phone, responder and dashboard screens (see README "Decisions":
// polling instead of WebSockets so it runs unchanged on Vercel).
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getLiveState } from "@/server/emergency";

export async function GET() {
  await connection(); // never prerender or cache: this is live data
  return NextResponse.json(await getLiveState(), { headers: { "Cache-Control": "no-store" } });
}

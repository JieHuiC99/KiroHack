// Polled every ~1.5 s by the phone, responder and dashboard screens (see README "Decisions":
// polling instead of WebSockets so it runs unchanged on Vercel).
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { getLiveState } from "@/server/emergency";

export function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(request); // reading the session also makes this per-request, never cached
    return NextResponse.json(await getLiveState(user), { headers: { "Cache-Control": "no-store" } });
  });
}

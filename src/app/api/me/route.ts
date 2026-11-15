// Who is signed in, as the app sees them. The sign-in page uses it to send each role to its own screen.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";

export function GET(request: Request) {
  return handle(async () => NextResponse.json(await requireApiUser(request), { headers: { "Cache-Control": "no-store" } }));
}

import { connection, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getLiveState } from "@/server/emergency";

export function GET() {
  return handle(async () => {
    await connection();
    return NextResponse.json(await getLiveState(), { headers: { "Cache-Control": "no-store" } });
  });
}

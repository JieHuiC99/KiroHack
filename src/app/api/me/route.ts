import { connection, NextResponse } from "next/server";
import { DEFAULT_USER } from "@/lib/default-user";

export async function GET() {
  await connection();
  return NextResponse.json(DEFAULT_USER, { headers: { "Cache-Control": "no-store" } });
}

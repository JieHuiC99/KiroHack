// Liveness + DB readiness probe for Docker HEALTHCHECK, uptime monitors and post-deploy smoke tests.
import { NextResponse } from "next/server";
import { getDb } from "@/db/data-source";

export async function GET() {
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch {
    // Don't leak connection details to the caller; the server log has the error.
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}

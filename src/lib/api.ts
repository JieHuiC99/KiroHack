import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NoActiveEmergencyError } from "@/server/emergency";

/** Shared error shaping for the JSON route handlers: expected failures become 4xx, the rest throw. */
export async function handle(run: () => Promise<unknown>) {
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    if (err instanceof NoActiveEmergencyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    throw err;
  }
}

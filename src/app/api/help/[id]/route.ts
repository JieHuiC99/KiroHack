import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { helpActionInput } from "@/lib/validation/emergency";
import { acceptHelp, resolveHelp } from "@/server/emergency";

export function POST(request: Request, context: RouteContext<"/api/help/[id]">) {
  return handle(async () => {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = helpActionInput.parse(await request.json());
    const changed = body.action === "accept" ? await acceptHelp(id, body.responderName) : await resolveHelp(id);
    return { ok: changed };
  });
}

// One venue. GET is polled by the classroom computer (and its startup agent, desktop/safeway-classroom-agent.ps1);
// POST is the classroom acknowledging, or the emergency team repeating the siren / marking the room clear.
import { connection, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { venueActionInput } from "@/lib/validation/venues";
import { applyVenueAction, getVenueState } from "@/server/venues";

export function GET(_request: Request, context: RouteContext<"/api/venues/[id]">) {
  return handle(async () => {
    await connection();
    const { id } = await context.params;
    return NextResponse.json(await getVenueState(id), { headers: { "Cache-Control": "no-store" } });
  });
}

export function POST(request: Request, context: RouteContext<"/api/venues/[id]">) {
  return handle(async () => {
    const { id } = await context.params;
    const { action } = venueActionInput.parse(await request.json());
    await applyVenueAction(id, action);
  });
}

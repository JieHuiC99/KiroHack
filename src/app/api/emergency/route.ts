import { z } from "zod";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { activateInput, blockStairInput } from "@/lib/validation/emergency";
import { activateEmergency, endEmergency, setStairBlocked } from "@/server/emergency";

const input = z.discriminatedUnion("action", [
  activateInput.extend({ action: z.literal("activate") }),
  z.object({ action: z.literal("end") }),
  blockStairInput.extend({ action: z.literal("block-stair") }),
]);

export function POST(request: Request) {
  return handle(async () => {
    await requireApiUser(request, "team");
    const body = input.parse(await request.json());
    if (body.action === "activate") await activateEmergency(body.floorId);
    if (body.action === "end") await endEmergency();
    if (body.action === "block-stair") await setStairBlocked(body.stairId, body.blocked);
  });
}

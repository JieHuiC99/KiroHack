import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { helpInput } from "@/lib/validation/emergency";
import { requestHelp } from "@/server/emergency";

export function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(request);
    const created = await requestHelp(user, helpInput.parse(await request.json()).roomId);
    return { id: created.id };
  });
}

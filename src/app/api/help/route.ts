import { handle } from "@/lib/api";
import { DEFAULT_USER } from "@/lib/default-user";
import { helpInput } from "@/lib/validation/emergency";
import { requestHelp } from "@/server/emergency";

export function POST(request: Request) {
  return handle(async () => {
    const user = DEFAULT_USER;
    const input = helpInput.parse(await request.json());
    const created = await requestHelp({ ...user, profile: input.profile }, input.roomId);
    return { id: created.id };
  });
}

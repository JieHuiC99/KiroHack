import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { checkIn } from "@/server/emergency";

export function POST(request: Request) {
  return handle(async () => {
    await checkIn(await requireApiUser(request));
  });
}

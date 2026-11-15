import { handle } from "@/lib/api";
import { DEFAULT_USER } from "@/lib/default-user";
import { checkIn } from "@/server/emergency";

export function POST() {
  return handle(async () => { await checkIn(DEFAULT_USER); });
}

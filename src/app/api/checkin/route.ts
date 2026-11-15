import { handle } from "@/lib/api";
import { checkInInput } from "@/lib/validation/emergency";
import { checkIn } from "@/server/emergency";

export function POST(request: Request) {
  return handle(async () => {
    await checkIn(checkInInput.parse(await request.json()).personName);
  });
}

import { handle } from "@/lib/api";
import { helpInput } from "@/lib/validation/emergency";
import { requestHelp } from "@/server/emergency";

export function POST(request: Request) {
  return handle(async () => {
    const created = await requestHelp(helpInput.parse(await request.json()));
    return { id: created.id };
  });
}

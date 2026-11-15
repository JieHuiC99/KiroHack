import { z } from "zod";

// Shared by client forms and server code — keep it free of server-only imports.
const name = z.string().trim().min(1, "Name is required").max(60);

export const profiles = ["blind", "wheelchair", "other"] as const;
export type Profile = (typeof profiles)[number];

export const activateInput = z.object({ floorId: z.string().min(1) });
export const blockStairInput = z.object({ stairId: z.string().min(1), blocked: z.boolean() });

export const helpInput = z.object({
  personName: name,
  profile: z.enum(profiles),
  roomId: z.string().min(1),
});
export type HelpInput = z.infer<typeof helpInput>;

export const helpActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("resolve") }),
]);

export const checkInInput = z.object({ personName: name });

/** What every screen polls from GET /api/state. Dates are ISO strings once they cross the wire. */
export type LiveState = {
  serverTime: string;
  escalationSeconds: number;
  emergency: null | {
    id: string;
    type: string;
    floorId: string;
    startedAt: string;
    blockedStairIds: string[];
  };
  requests: {
    id: string;
    personName: string;
    profile: Profile;
    roomId: string;
    waitStairId: string | null;
    status: "pending" | "accepted" | "resolved";
    responderName: string | null;
    createdAt: string;
    /** 0 = first responder, 1 = all responders, 2 = floor marshal / emergency response team. */
    escalationLevel: 0 | 1 | 2;
  }[];
  safeNames: string[];
};

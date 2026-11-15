import { z } from "zod";

// Shared by client forms and server code — keep it free of server-only imports.

export const profiles = ["blind", "wheelchair", "other"] as const;
export type Profile = (typeof profiles)[number];

export const activateInput = z.object({ floorId: z.string().min(1) });
export const blockStairInput = z.object({ stairId: z.string().min(1), blocked: z.boolean() });

/** Location and accessibility preferences; the identity always comes from the shared default user. */
export const helpInput = z.object({ roomId: z.string().min(1).max(60), profile: z.enum(profiles).default("other") });

export const helpActionInput = z.object({ action: z.enum(["accept", "resolve"]) });

/**
 * What every screen polls from GET /api/state. Dates are ISO strings once they cross the wire.
 * The shared Emergency administrator receives every active help request and check-in.
 */
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
    personId: string;
    personName: string;
    profile: Profile;
    /** Null once the person is evacuated: their location is not kept. */
    roomId: string | null;
    waitStairId: string | null;
    status: "pending" | "accepted" | "resolved";
    responderName: string | null;
    createdAt: string;
    /** 0 = first responder, 1 = all responders, 2 = floor marshal / emergency response team. */
    escalationLevel: 0 | 1 | 2;
  }[];
  safeNames: string[];
  /** User ids of everyone in `safeNames`, in the same order. */
  safeIds: string[];
};

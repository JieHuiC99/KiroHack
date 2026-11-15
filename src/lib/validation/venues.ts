import { z } from "zod";
import type { ClassSession, Venue } from "@/lib/venues";

// Shared by the monitor, the classroom screen and the server — keep it free of server-only imports.

/** acknowledge: pressed in the classroom. siren / clear / occupied: pressed by the emergency team. */
export const venueActionInput = z.object({ action: z.enum(["acknowledge", "siren", "clear", "occupied"]) });
export type VenueAction = z.infer<typeof venueActionInput>["action"];

export type VenueStatus = Venue & {
  /** The class in the room right now, or null if it is free. */
  session: ClassSession | null;
  /** Null when there is no alarm. */
  alert: null | {
    /** 1 for the first siren, higher each time the emergency team repeats it. */
    sirenRound: number;
    /** The classroom has answered the latest siren. */
    acknowledged: boolean;
    acknowledgedAt: string | null;
    /** The emergency team has confirmed the room is empty. */
    cleared: boolean;
  };
};

type Alarm = null | { id: string; floorLabel: string; startedAt: string; assemblyPoint: string };

/** GET /api/venues: everything the venue monitor shows. */
export type VenueBoard = { serverTime: string; emergency: Alarm; venues: VenueStatus[] };

/** GET /api/venues/[id]: what one classroom computer polls. */
export type VenueState = { serverTime: string; emergency: Alarm; venue: VenueStatus };

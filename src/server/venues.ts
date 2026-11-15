import "server-only";
import { getDb } from "@/db/data-source";
import { VenueAlert, type Emergency } from "@/db/entities";
import { getFloor, ground } from "@/lib/floor/building";
import type { VenueAction, VenueBoard, VenueState, VenueStatus } from "@/lib/validation/venues";
import { classAt, getVenue, venues, type Venue } from "@/lib/venues";
import { activeEmergency, requireActiveEmergency } from "./emergency";

// Classroom alerts: which venues are in use, which have answered the alarm, and the siren repeats.
//
// Who may call what is decided in the route handlers: a classroom computer (device key) may read its
// room and acknowledge; only the emergency team may read the board, repeat a siren or mark a room clear.

export class UnknownVenueError extends Error {
  constructor(venueId: string) {
    super(`Unknown venue ${venueId}`);
  }
}

function requireVenue(venueId: string): Venue {
  const venue = getVenue(venueId);
  if (!venue) throw new UnknownVenueError(venueId);
  return venue;
}

function describeAlarm(emergency: Emergency | null) {
  if (!emergency) return null;
  return {
    id: emergency.id,
    floorLabel: getFloor(emergency.floorId)?.label ?? "the building",
    startedAt: emergency.startedAt.toISOString(),
    assemblyPoint: ground.assemblyPoint,
  };
}

function status(venue: Venue, now: Date, alarmActive: boolean, row: VenueAlert | undefined): VenueStatus {
  const sirenRound = row?.sirenRound ?? 1;
  return {
    ...venue,
    session: classAt(venue.id, now),
    alert: alarmActive
      ? {
          sirenRound,
          acknowledged: (row?.ackRound ?? 0) >= sirenRound,
          acknowledgedAt: row?.ackAt?.toISOString() ?? null,
          cleared: row?.clearedAt != null,
        }
      : null,
  };
}

export async function getVenueBoard(): Promise<VenueBoard> {
  const now = new Date();
  const emergency = await activeEmergency();
  const db = await getDb();
  const rows = emergency ? await db.getRepository(VenueAlert).find({ where: { emergencyId: emergency.id } }) : [];
  const byVenue = new Map(rows.map((r) => [r.venueId, r]));
  return {
    serverTime: now.toISOString(),
    emergency: describeAlarm(emergency),
    venues: venues.map((v) => status(v, now, emergency !== null, byVenue.get(v.id))),
  };
}

export async function getVenueState(venueId: string): Promise<VenueState> {
  const venue = requireVenue(venueId);
  const now = new Date();
  const emergency = await activeEmergency();
  const db = await getDb();
  const row = emergency ? await db.getRepository(VenueAlert).findOne({ where: { emergencyId: emergency.id, venueId } }) : null;
  return { serverTime: now.toISOString(), emergency: describeAlarm(emergency), venue: status(venue, now, emergency !== null, row ?? undefined) };
}

export async function applyVenueAction(venueId: string, action: VenueAction) {
  requireVenue(venueId);
  const emergency = await requireActiveEmergency();
  const db = await getDb();
  const alerts = db.getRepository(VenueAlert);
  const key = { emergencyId: emergency.id, venueId };
  // Make sure the row exists; two screens doing this at once is fine, the unique index keeps one.
  await alerts.createQueryBuilder().insert().values(key).orIgnore().execute();

  if (action === "acknowledge") {
    // Answers whichever siren round is current, so a repeat that lands at the same moment still shows.
    await alerts.update(key, { ackRound: () => `"sirenRound"`, ackAt: new Date() });
  } else if (action === "siren") {
    // People are still in the room: sound again, and it can't be "clear" any more.
    await alerts.update(key, { sirenRound: () => `"sirenRound" + 1`, clearedAt: null });
  } else {
    await alerts.update(key, { clearedAt: action === "clear" ? new Date() : null });
  }
}

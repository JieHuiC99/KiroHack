import "server-only";
import { getDb } from "@/db/data-source";
import { CheckIn, Emergency, HelpRequest } from "@/db/entities";
import { getFloor } from "@/lib/floor/building";
import { findRoute } from "@/lib/floor/routing";
import type { HelpInput, LiveState } from "@/lib/validation/emergency";

// Service layer: the only place that talks to TypeORM for the emergency flow.
//
// ⚠ Hackathon decision: there is no sign-in on these flows, so anyone who can reach the URL
// can trigger an alarm or accept a request. Before real use, gate every function here with
// requireUser() and a role check (see README "Decisions").

/** Seconds a request can sit unanswered before each escalation. Kept short for the demo. */
const ESCALATION_SECONDS = Number(process.env.ESCALATION_SECONDS ?? 15);

export class NoActiveEmergencyError extends Error {
  constructor() {
    super("There is no active emergency");
  }
}

export async function activeEmergency() {
  const db = await getDb();
  return db.getRepository(Emergency).findOne({ where: { status: "active" }, order: { startedAt: "DESC" } });
}

export async function requireActiveEmergency() {
  const emergency = await activeEmergency();
  if (!emergency) throw new NoActiveEmergencyError();
  return emergency;
}

/** Escalation is derived from how long a request has waited, so no background job is needed. */
export function escalationLevel(createdAt: Date, now: Date, stepSeconds = ESCALATION_SECONDS): 0 | 1 | 2 {
  const waited = (now.getTime() - createdAt.getTime()) / 1000;
  if (waited >= stepSeconds * 2) return 2;
  return waited >= stepSeconds ? 1 : 0;
}

export async function activateEmergency(floorId: string) {
  if (!getFloor(floorId)) throw new Error(`Unknown floor ${floorId}`);
  const existing = await activeEmergency();
  if (existing) return existing;
  const db = await getDb();
  return db.getRepository(Emergency).save({ floorId, type: "fire" });
}

export async function endEmergency() {
  const emergency = await activeEmergency();
  if (!emergency) return;
  const db = await getDb();
  await db.getRepository(Emergency).update(emergency.id, { status: "ended", endedAt: new Date() });
}

export async function setStairBlocked(stairId: string, blocked: boolean) {
  const emergency = await requireActiveEmergency();
  const ids = new Set(emergency.blockedStairIds);
  if (blocked) ids.add(stairId);
  else ids.delete(stairId);
  const db = await getDb();
  await db.getRepository(Emergency).update(emergency.id, { blockedStairIds: [...ids] });
}

/** One open request per person: pressing the button twice doesn't create a second one. */
export async function requestHelp(input: HelpInput) {
  const emergency = await requireActiveEmergency();
  const db = await getDb();
  const requests = db.getRepository(HelpRequest);

  const open = await requests.findOne({
    where: [
      { emergencyId: emergency.id, personName: input.personName, status: "pending" },
      { emergencyId: emergency.id, personName: input.personName, status: "accepted" },
    ],
  });
  if (open) return open;

  const floor = getFloor(emergency.floorId);
  const route = floor
    ? findRoute(floor, input.roomId, { blockedStairIds: emergency.blockedStairIds, needsAssistance: true })
    : null;

  return requests.save({ ...input, emergencyId: emergency.id, waitStairId: route?.stairId ?? null });
}

export async function acceptHelp(requestId: string, responderName: string) {
  const db = await getDb();
  // The status condition makes sure two responders can't both take the same request.
  const result = await db
    .getRepository(HelpRequest)
    .update({ id: requestId, status: "pending" }, { status: "accepted", responderName, acceptedAt: new Date() });
  return result.affected === 1;
}

export async function resolveHelp(requestId: string) {
  const db = await getDb();
  const result = await db
    .getRepository(HelpRequest)
    .update({ id: requestId, status: "accepted" }, { status: "resolved", resolvedAt: new Date() });
  return result.affected === 1;
}

export async function checkIn(personName: string) {
  const emergency = await requireActiveEmergency();
  const db = await getDb();
  await db
    .getRepository(CheckIn)
    .upsert({ emergencyId: emergency.id, personName }, { conflictPaths: ["emergencyId", "personName"] });
}

export async function getLiveState(): Promise<LiveState> {
  const now = new Date();
  const base = { serverTime: now.toISOString(), escalationSeconds: ESCALATION_SECONDS };
  const emergency = await activeEmergency();
  if (!emergency) return { ...base, emergency: null, requests: [], safeNames: [] };

  const db = await getDb();
  const [requests, checkIns] = await Promise.all([
    db.getRepository(HelpRequest).find({ where: { emergencyId: emergency.id }, order: { createdAt: "ASC" } }),
    db.getRepository(CheckIn).find({ where: { emergencyId: emergency.id }, order: { createdAt: "ASC" } }),
  ]);

  return {
    ...base,
    emergency: {
      id: emergency.id,
      type: emergency.type,
      floorId: emergency.floorId,
      startedAt: emergency.startedAt.toISOString(),
      blockedStairIds: emergency.blockedStairIds,
    },
    requests: requests.map((r) => ({
      id: r.id,
      personName: r.personName,
      profile: r.profile,
      roomId: r.roomId,
      waitStairId: r.waitStairId,
      status: r.status,
      responderName: r.responderName,
      createdAt: r.createdAt.toISOString(),
      escalationLevel: r.status === "pending" ? escalationLevel(r.createdAt, now) : 0,
    })),
    safeNames: checkIns.map((c) => c.personName),
  };
}

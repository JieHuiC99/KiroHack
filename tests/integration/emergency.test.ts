import { describe, expect, it } from "vitest";
import {
  acceptHelp,
  activateEmergency,
  checkIn,
  endEmergency,
  escalationLevel,
  getLiveState,
  requestHelp,
  resolveHelp,
  setStairBlocked,
} from "@/server/emergency";
import { person } from "./helpers";

const aisha = person("Aisha", "wheelchair");
const ROOM = "uc-3-3";

describe("emergency flow (real Postgres)", () => {
  it("starts with no emergency and only ever has one active", async () => {
    expect((await getLiveState()).emergency).toBeNull();
    const first = await activateEmergency("uni-l3");
    const second = await activateEmergency("uni-l3");
    expect(second.id).toBe(first.id);
  });

  it("takes a help request from pending to accepted to resolved", async () => {
    await activateEmergency("uni-l3");
    const request = await requestHelp(aisha, ROOM);
    expect(request).toMatchObject({ personId: aisha.id, personName: "Aisha", profile: "wheelchair", waitStairId: "bomba-w" });

    expect(await acceptHelp(request.id, "Ben")).toBe(true);
    expect(await acceptHelp(request.id, "Chen")).toBe(false); // already taken
    expect(await resolveHelp(request.id)).toBe(true);

    const [live] = (await getLiveState()).requests;
    expect(live).toMatchObject({ status: "resolved", responderName: "Ben" });
  });

  it("does not create a second open request for the same person", async () => {
    await activateEmergency("uni-l3");
    const first = await requestHelp(aisha, ROOM);
    const again = await requestHelp(aisha, "uc-3-4");
    expect(again.id).toBe(first.id);
  });

  it("sends people to the other Bomba lift when theirs is blocked", async () => {
    await activateEmergency("uni-l3");
    await setStairBlocked("bomba-w", true);
    expect((await requestHelp(aisha, ROOM)).waitStairId).toBe("bomba-e");
    expect((await getLiveState()).emergency?.blockedStairIds).toEqual(["bomba-w"]);
  });

  it("counts each person once at the assembly point, even two people with the same name", async () => {
    await activateEmergency("uni-l3");
    await checkIn(aisha);
    await checkIn(aisha);
    await checkIn({ ...aisha, id: "test-another-aisha" });
    const state = await getLiveState();
    expect(state.safeNames).toEqual(["Aisha", "Aisha"]);
    expect(state.safeIds).toEqual([aisha.id, "test-another-aisha"]);
  });

  it("clears the live view when the emergency ends", async () => {
    await activateEmergency("uni-l3");
    await requestHelp(aisha, ROOM);
    await endEmergency();
    expect(await getLiveState()).toMatchObject({ emergency: null, requests: [] });
  });
});

describe("who sees what", () => {
  it("shows every request and check-in to the shared administrator", async () => {
    const other = person("Farid");
    await activateEmergency("uni-l3");
    await requestHelp(aisha, ROOM);
    await requestHelp(other, "uc-3-4");
    await checkIn(other);

    const asAisha = await getLiveState();
    expect(asAisha.requests.map((r) => r.personName)).toEqual(["Aisha", "Farid"]);
    expect(asAisha.safeIds).toEqual([other.id]);

    expect((await getLiveState()).safeIds).toEqual([other.id]);
    expect((await getLiveState()).requests).toHaveLength(2);
    expect((await getLiveState()).safeNames).toEqual(["Farid"]);
  });
});

describe("location is not kept", () => {
  it("holds the room while the rescue is open and forgets it once the person is evacuated", async () => {
    await activateEmergency("uni-l3");
    const request = await requestHelp(aisha, ROOM);
    await acceptHelp(request.id, "Ben");
    expect((await getLiveState()).requests[0]).toMatchObject({ roomId: ROOM, waitStairId: "bomba-w" });

    await resolveHelp(request.id);
    expect((await getLiveState()).requests[0]).toMatchObject({ status: "resolved", roomId: null, waitStairId: null });
  });

  it("forgets every room when the emergency ends, including requests nobody answered", async () => {
    const first = await activateEmergency("uni-l3");
    await requestHelp(aisha, ROOM);
    await endEmergency();

    const { getDb } = await import("@/db/data-source");
    const { HelpRequest } = await import("@/db/entities");
    const rows = await (await getDb()).getRepository(HelpRequest).find({ where: { emergencyId: first.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ personName: "Aisha", roomId: null, waitStairId: null });
  });
});

describe("escalationLevel", () => {
  it("rises one level per unanswered interval", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const after = (seconds: number) => new Date(created.getTime() + seconds * 1000);
    expect(escalationLevel(created, after(5), 15)).toBe(0);
    expect(escalationLevel(created, after(15), 15)).toBe(1);
    expect(escalationLevel(created, after(31), 15)).toBe(2);
  });
});

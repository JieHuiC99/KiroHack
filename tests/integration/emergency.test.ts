import { describe, expect, it } from "vitest";
import { POST as helpRoute } from "@/app/api/help/route";
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

const aisha = { personName: "Aisha", profile: "wheelchair" as const, roomId: "uc-3-3" };

describe("emergency flow (real Postgres)", () => {
  it("starts with no emergency and only ever has one active", async () => {
    expect((await getLiveState()).emergency).toBeNull();
    const first = await activateEmergency("uni-l3");
    const second = await activateEmergency("uni-l3");
    expect(second.id).toBe(first.id);
  });

  it("takes a help request from pending to accepted to resolved", async () => {
    await activateEmergency("uni-l3");
    const request = await requestHelp(aisha);
    expect(request.waitStairId).toBe("stair-sw");

    expect(await acceptHelp(request.id, "Ben")).toBe(true);
    expect(await acceptHelp(request.id, "Chen")).toBe(false); // already taken
    expect(await resolveHelp(request.id)).toBe(true);

    const [live] = (await getLiveState()).requests;
    expect(live).toMatchObject({ status: "resolved", responderName: "Ben" });
  });

  it("does not create a second open request for the same person", async () => {
    await activateEmergency("uni-l3");
    const first = await requestHelp(aisha);
    const again = await requestHelp(aisha);
    expect(again.id).toBe(first.id);
  });

  it("sends people to another landing when a staircase is blocked", async () => {
    await activateEmergency("uni-l3");
    await setStairBlocked("stair-sw", true);
    expect((await requestHelp(aisha)).waitStairId).toBe("stair-se");
    expect((await getLiveState()).emergency?.blockedStairIds).toEqual(["stair-sw"]);
  });

  it("counts each person once at the assembly point", async () => {
    await activateEmergency("uni-l3");
    await checkIn("Aisha");
    await checkIn("Aisha");
    expect((await getLiveState()).safeNames).toEqual(["Aisha"]);
  });

  it("clears the live view when the emergency ends", async () => {
    await activateEmergency("uni-l3");
    await requestHelp(aisha);
    await endEmergency();
    expect(await getLiveState()).toMatchObject({ emergency: null, requests: [] });
  });
});

describe("/api/help route handler", () => {
  const post = (body: unknown) => helpRoute(new Request("http://test/api/help", { method: "POST", body: JSON.stringify(body) }));

  it("rejects a request when there is no emergency", async () => {
    expect((await post(aisha)).status).toBe(409);
  });

  it("rejects invalid input", async () => {
    await activateEmergency("uni-l3");
    expect((await post({ ...aisha, personName: " " })).status).toBe(400);
    expect((await post({ ...aisha, profile: "vip" })).status).toBe(400);
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

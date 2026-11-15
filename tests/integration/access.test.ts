import { beforeAll, describe, expect, it } from "vitest";
import { POST as checkInRoute } from "@/app/api/checkin/route";
import { POST as emergencyRoute } from "@/app/api/emergency/route";
import { POST as helpActionRoute } from "@/app/api/help/[id]/route";
import { POST as helpRoute } from "@/app/api/help/route";
import { GET as meRoute } from "@/app/api/me/route";
import { GET as stateRoute } from "@/app/api/state/route";
import { GET as venueRoute, POST as venueActionRoute } from "@/app/api/venues/[id]/route";
import { GET as boardRoute } from "@/app/api/venues/route";
import { activateEmergency } from "@/server/emergency";
import { request, signedIn } from "./helpers";

// Role lists and the device key come from .env.test.
const DEVICE_KEY = process.env.CLASSROOM_DEVICE_KEY!;
const ROOM = "uc-3-3";
const at = (id: string) => ({ params: Promise.resolve({ id }) });

type Account = Awaited<ReturnType<typeof signedIn>>;
let student: Account;
let responder: Account;
let team: Account;

beforeAll(async () => {
  student = await signedIn("aisha@safeway.test", "Aisha", "wheelchair");
  responder = await signedIn("ben@safeway.test", "Ben");
  team = await signedIn("team@safeway.test", "Chief");
});

describe("sign-in and roles", () => {
  it("works out the role from the server's lists and keeps the chosen profile", async () => {
    expect(student.user).toMatchObject({ role: "student", profile: "wheelchair" });
    expect(responder.user.role).toBe("responder");
    expect(team.user.role).toBe("team");
    const me = await (await meRoute(request({ cookie: student.cookie }))).json();
    expect(me).toEqual(student.user);
  });

  it("turns away anyone who is not signed in, on every route", async () => {
    const statuses = await Promise.all([
      meRoute(request()),
      stateRoute(request()),
      boardRoute(request()),
      helpRoute(request({ body: { roomId: ROOM } })),
      checkInRoute(request({ body: {} })),
      emergencyRoute(request({ body: { action: "activate", floorId: "uni-l3" } })),
      helpActionRoute(request({ body: { action: "accept" } }), at("00000000-0000-4000-8000-000000000000")),
      venueRoute(request(), at(ROOM)),
      venueActionRoute(request({ body: { action: "acknowledge" } }), at(ROOM)),
    ]);
    expect(statuses.map((r) => r.status)).toEqual(Array(9).fill(401));
  });
});

describe("the alarm and the venue board belong to the disaster recovery team", () => {
  const activate = (cookie: string) => emergencyRoute(request({ cookie, body: { action: "activate", floorId: "uni-l3" } }));

  it("lets only the team trigger the alarm", async () => {
    expect((await activate(student.cookie)).status).toBe(403);
    expect((await activate(responder.cookie)).status).toBe(403);
    expect((await activate(team.cookie)).status).toBe(200);
  });

  it("lets only the team read the venue board, repeat a siren or mark a room empty", async () => {
    await activateEmergency("uni-l3");
    expect((await boardRoute(request({ cookie: student.cookie }))).status).toBe(403);
    expect((await boardRoute(request({ cookie: team.cookie }))).status).toBe(200);
    for (const action of ["siren", "clear", "occupied"]) {
      expect((await venueActionRoute(request({ cookie: student.cookie, body: { action } }), at(ROOM))).status).toBe(403);
      expect((await venueActionRoute(request({ deviceKey: DEVICE_KEY, body: { action } }), at(ROOM))).status).toBe(401);
      expect((await venueActionRoute(request({ cookie: team.cookie, body: { action } }), at(ROOM))).status).toBe(200);
    }
  });
});

describe("classroom computers", () => {
  it("can read their room and acknowledge with the device key, and with nothing else", async () => {
    await activateEmergency("uni-l3");
    expect((await venueRoute(request({ deviceKey: "wrong-key-wrong-key-wrong-key" }), at(ROOM))).status).toBe(401);
    expect((await venueRoute(request({ cookie: student.cookie }), at(ROOM))).status).toBe(403);
    expect((await venueRoute(request({ deviceKey: DEVICE_KEY }), at(ROOM))).status).toBe(200);

    expect((await venueActionRoute(request({ deviceKey: DEVICE_KEY, body: { action: "acknowledge" } }), at(ROOM))).status).toBe(200);
    const state = await (await venueRoute(request({ deviceKey: DEVICE_KEY }), at(ROOM))).json();
    expect(state.venue.alert.acknowledged).toBe(true);
  });

  it("answers 404 for an unknown room, 409 with no alarm and 400 for a bad action", async () => {
    expect((await venueRoute(request({ deviceKey: DEVICE_KEY }), at("nowhere"))).status).toBe(404);
    expect((await venueActionRoute(request({ deviceKey: DEVICE_KEY, body: { action: "acknowledge" } }), at(ROOM))).status).toBe(409);
    expect((await venueActionRoute(request({ cookie: team.cookie, body: { action: "explode" } }), at(ROOM))).status).toBe(400);
  });
});

describe("help requests", () => {
  it("takes who is asking from the session, not from the request", async () => {
    await activateEmergency("uni-l3");
    const spoof = { roomId: ROOM, personId: team.user.id, personName: "Someone Else", profile: "other" };
    expect((await helpRoute(request({ cookie: student.cookie, body: spoof }))).status).toBe(200);

    const state = await (await stateRoute(request({ cookie: responder.cookie }))).json();
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toMatchObject({ personId: student.user.id, personName: "Aisha", profile: "wheelchair" });
  });

  it("lets responders, not students, accept and resolve, under their own name", async () => {
    await activateEmergency("uni-l3");
    const { id } = await (await helpRoute(request({ cookie: student.cookie, body: { roomId: ROOM } }))).json();
    const accept = (cookie: string) => helpActionRoute(request({ cookie, body: { action: "accept", responderName: "Impostor" } }), at(id));

    expect((await accept(student.cookie)).status).toBe(403);
    expect((await accept(responder.cookie)).status).toBe(200);
    const mine = await (await stateRoute(request({ cookie: student.cookie }))).json();
    expect(mine.requests[0]).toMatchObject({ status: "accepted", responderName: "Ben" });
  });

  it("rejects a request with no room, or with no alarm active", async () => {
    expect((await helpRoute(request({ cookie: student.cookie, body: { roomId: ROOM } }))).status).toBe(409);
    await activateEmergency("uni-l3");
    expect((await helpRoute(request({ cookie: student.cookie, body: {} }))).status).toBe(400);
  });

  it("checks in the signed-in person only", async () => {
    await activateEmergency("uni-l3");
    expect((await checkInRoute(request({ cookie: student.cookie, body: { personName: "Chief" } }))).status).toBe(200);
    const state = await (await stateRoute(request({ cookie: team.cookie }))).json();
    expect(state.safeIds).toEqual([student.user.id]);
  });
});

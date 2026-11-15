import { describe, expect, it, vi } from "vitest";
import { POST as checkInRoute } from "@/app/api/checkin/route";
import { POST as emergencyRoute } from "@/app/api/emergency/route";
import { POST as helpActionRoute } from "@/app/api/help/[id]/route";
import { POST as helpRoute } from "@/app/api/help/route";
import { GET as meRoute } from "@/app/api/me/route";
import { GET as stateRoute } from "@/app/api/state/route";
import { GET as venueRoute, POST as venueActionRoute } from "@/app/api/venues/[id]/route";
import { GET as boardRoute } from "@/app/api/venues/route";
import { DEFAULT_USER } from "@/lib/default-user";
import { activateEmergency } from "@/server/emergency";
import { request } from "./helpers";

// Route handlers normally run within Next's request context.
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), connection: async () => {} }));
const ROOM = "uc-3-3";
const at = (id: string) => ({ params: Promise.resolve({ id }) });

describe("shared Emergency administrator without authentication", () => {
  it("opens the identity, state, venue board and classroom endpoints without credentials", async () => {
    expect(await (await meRoute()).json()).toEqual(DEFAULT_USER);
    expect((await stateRoute()).status).toBe(200);
    expect((await boardRoute()).status).toBe(200);
    expect((await venueRoute(request(), at(ROOM))).status).toBe(200);
  });

  it("allows alarm control and every classroom action without a session or device key", async () => {
    expect((await emergencyRoute(request({ body: { action: "activate", floorId: "uni-l3" } }))).status).toBe(200);
    for (const action of ["acknowledge", "siren", "clear", "occupied"]) {
      expect((await venueActionRoute(request({ body: { action } }), at(ROOM))).status).toBe(200);
    }
  });

  it("uses the default identity for help requests, responses and check-in", async () => {
    await activateEmergency("uni-l3");
    const response = await helpRoute(request({ body: { roomId: ROOM, profile: "wheelchair", personName: "Someone Else" } }));
    const { id } = await response.json();
    expect(response.status).toBe(200);
    expect((await helpActionRoute(request({ body: { action: "accept", responderName: "Impostor" } }), at(id))).status).toBe(200);
    const state = await (await stateRoute()).json();
    expect(state.requests[0]).toMatchObject({ personId: DEFAULT_USER.id, personName: DEFAULT_USER.name, profile: "wheelchair", responderName: DEFAULT_USER.name });
    expect((await helpActionRoute(request({ body: { action: "resolve" } }), at(id))).status).toBe(200);
    expect((await checkInRoute()).status).toBe(200);
    expect((await (await stateRoute()).json()).safeIds).toEqual([DEFAULT_USER.id]);
  });

  it("still validates input and requires an active alarm", async () => {
    expect((await helpRoute(request({ body: { roomId: ROOM } }))).status).toBe(409);
    expect((await venueRoute(request(), at("nowhere"))).status).toBe(404);
    await activateEmergency("uni-l3");
    expect((await helpRoute(request({ body: {} }))).status).toBe(400);
    expect((await venueActionRoute(request({ body: { action: "explode" } }), at(ROOM))).status).toBe(400);
  });
});

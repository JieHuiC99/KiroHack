import { describe, expect, it } from "vitest";
import { GET as venueRoute, POST as venueActionRoute } from "@/app/api/venues/[id]/route";
import { venues } from "@/lib/venues";
import { activateEmergency, endEmergency } from "@/server/emergency";
import { applyVenueAction, getVenueBoard, getVenueState } from "@/server/venues";

const ROOM = "uc-3-3";
const alertOf = async (venueId = ROOM) => (await getVenueState(venueId)).venue.alert;
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const action = (body: unknown) => new Request("http://test/api/venues/x", { method: "POST", body: JSON.stringify(body) });

describe("classroom alerts (real Postgres)", () => {
  it("lists every venue with no alert while there is no alarm", async () => {
    const board = await getVenueBoard();
    expect(board.emergency).toBeNull();
    expect(board.venues.map((v) => v.id)).toEqual(venues.map((v) => v.id));
    expect(board.venues.every((v) => v.alert === null)).toBe(true);
  });

  it("prompts every venue when the alarm starts, until each one acknowledges", async () => {
    await activateEmergency("uni-l3");
    expect(await alertOf()).toEqual({ sirenRound: 1, acknowledged: false, acknowledgedAt: null, cleared: false });

    await applyVenueAction(ROOM, "acknowledge");
    expect(await alertOf()).toMatchObject({ sirenRound: 1, acknowledged: true });
    expect((await alertOf())?.acknowledgedAt).not.toBeNull();
    // Only that room has answered.
    expect(await alertOf("lt-5")).toMatchObject({ acknowledged: false });
  });

  it("prompts the room again when the emergency team repeats the siren", async () => {
    await activateEmergency("uni-l3");
    await applyVenueAction(ROOM, "acknowledge");
    await applyVenueAction(ROOM, "siren");
    expect(await alertOf()).toMatchObject({ sirenRound: 2, acknowledged: false });

    await applyVenueAction(ROOM, "acknowledge");
    expect(await alertOf()).toMatchObject({ sirenRound: 2, acknowledged: true });
  });

  it("marks a room empty, and un-marks it when the siren is repeated", async () => {
    await activateEmergency("uni-l3");
    await applyVenueAction(ROOM, "clear");
    expect(await alertOf()).toMatchObject({ cleared: true });
    await applyVenueAction(ROOM, "siren");
    expect(await alertOf()).toMatchObject({ cleared: false, sirenRound: 2 });
    await applyVenueAction(ROOM, "clear");
    await applyVenueAction(ROOM, "occupied");
    expect(await alertOf()).toMatchObject({ cleared: false });
  });

  it("starts every room fresh for the next alarm", async () => {
    await activateEmergency("uni-l3");
    await applyVenueAction(ROOM, "acknowledge");
    await endEmergency();
    expect(await alertOf()).toBeNull();
    await activateEmergency("uni-l3");
    expect(await alertOf()).toMatchObject({ sirenRound: 1, acknowledged: false });
  });

  it("answers the API with 404 for an unknown room, 409 with no alarm and 400 for a bad action", async () => {
    expect((await venueRoute(new Request("http://test"), context("nowhere"))).status).toBe(404);
    expect((await venueActionRoute(action({ action: "acknowledge" }), context(ROOM))).status).toBe(409);
    await activateEmergency("uni-l3");
    expect((await venueActionRoute(action({ action: "explode" }), context(ROOM))).status).toBe(400);
    expect((await venueActionRoute(action({ action: "acknowledge" }), context(ROOM))).status).toBe(200);
    const body = await (await venueRoute(new Request("http://test"), context(ROOM))).json();
    expect(body.venue.alert.acknowledged).toBe(true);
  });
});

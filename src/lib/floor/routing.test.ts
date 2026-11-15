import { describe, expect, it } from "vitest";
import { findEvacuationRoute, floors, ground, level3 } from "./building";
import { bombaLifts, buildGraph, findRoute, remainingPath, selectableRooms, staircases, turnBetween } from "./routing";

describe("level 3 floor data", () => {
  it("puts every door on a corridor centre line", () => {
    const graph = buildGraph(level3);
    const offLine = level3.rooms.filter((r) => r.door && !graph.has(`${r.door.x},${r.door.y}`));
    expect(offLine.map((r) => r.id)).toEqual([]);
  });

  it("can route every selectable room to a staircase", () => {
    const unroutable = selectableRooms(level3).filter((r) => !findRoute(level3, r.id));
    expect(unroutable.map((r) => r.id)).toEqual([]);
  });
});

describe("building data", () => {
  it("has the four corner staircases on every floor, with a ground exit for each", () => {
    const ids = ["stair-ne", "stair-nw", "stair-se", "stair-sw"];
    for (const floor of floors) {
      expect(staircases(floor).map((s) => s.id).sort()).toEqual(ids);
    }
    expect(Object.keys(ground.groundExits!).sort()).toEqual(["bomba-e", "bomba-w", ...ids]);
  });

  it("has the two Bomba lifts on every floor, apart from the ordinary lifts", () => {
    for (const floor of floors) {
      expect(bombaLifts(floor).map((l) => l.id).sort()).toEqual(["bomba-e", "bomba-w"]);
      expect(floor.rooms.some((r) => r.kind === "lift")).toBe(true);
    }
  });

  it("has unique room ids apart from the staircases and Bomba lifts", () => {
    const ids = floors.flatMap((f) => f.rooms.filter((r) => r.kind !== "stairs" && r.kind !== "bombaLift").map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findRoute (same floor)", () => {
  it("picks the nearest staircase", () => {
    expect(findRoute(level3, "uc-3-3")?.stairId).toBe("stair-sw");
    expect(findRoute(level3, "meeting-1")?.stairId).toBe("stair-se");
  });

  it("avoids a blocked staircase", () => {
    expect(findRoute(level3, "uc-3-3", { blockedStairIds: ["stair-sw"] })?.stairId).toBe("stair-se");
  });

  it("returns null when every staircase is blocked", () => {
    const all = staircases(level3).map((s) => s.id);
    expect(findRoute(level3, "uc-3-3", { blockedStairIds: all })).toBeNull();
  });

  it("sends people who can't use stairs to the nearest Bomba lift to wait for a helper", () => {
    const route = findRoute(level3, "uc-3-3", { needsAssistance: true })!;
    expect(route).toMatchObject({ stairId: "bomba-w", exitKind: "bombaLift" });
    const last = route.steps.at(-1)!;
    expect(last.wait).toBe(true);
    expect(last.text).toContain("Wait in front of the west Bomba lift");
    expect(last.text).toContain("Do not use the ordinary lifts");
  });

  it("never sends people who can walk to a lift", () => {
    for (const room of selectableRooms(level3)) expect(findRoute(level3, room.id)?.exitKind).toBe("stairs");
  });

  it("falls back to the other Bomba lift, then to a staircase landing, when Bomba lifts are blocked", () => {
    expect(findRoute(level3, "uc-3-3", { needsAssistance: true, blockedStairIds: ["bomba-w"] })?.stairId).toBe("bomba-e");
    const landing = findRoute(level3, "uc-3-3", { needsAssistance: true, blockedStairIds: ["bomba-w", "bomba-e"] })!;
    expect(landing.exitKind).toBe("stairs");
    expect(landing.steps.at(-1)!.text).toContain("wait on the landing of the south-west staircase");
  });

  it("gives turn-by-turn steps with distances", () => {
    const steps = findRoute(level3, "uc-3-3")!.steps.map((s) => s.text);
    expect(steps[0]).toBe("Leave UC-3-3 through the door. Turn right.");
    expect(steps[1]).toMatch(/^Walk about \d+ metres along the corridor\. Then turn left\.$/);
  });
});

describe("findEvacuationRoute (whole building)", () => {
  const route = findEvacuationRoute("uni-l3", "meeting-1")!;

  it("goes down through every floor and ends on the field", () => {
    const visited = [...new Set(route.path.map((p) => p.floorId))];
    expect(visited).toEqual(["uni-l3", "uni-l2", "uni-l1", "uni-m", "uni-g"]);
    const end = route.path.at(-1)!;
    const field = ground.field!;
    expect(end.x).toBeGreaterThan(field.x);
    expect(end.x).toBeLessThan(field.x + field.w);
    expect(end.y).toBeGreaterThan(field.y);
  });

  it("has one step per floor on the way down, and ends at the assembly point", () => {
    const texts = route.steps.map((s) => s.text);
    expect(texts.some((t) => t.includes("walk down one floor to Level 2"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Level 2. Stay in the staircase") && t.includes("3 more floors"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Mezzanine.") && t.includes("1 more floor to"))).toBe(true);
    expect(texts.at(-1)).toContain("assembly point on the field");
    // Each step knows which floor it is on, in order from the top down.
    const stepFloors = [...new Set(route.steps.map((s) => s.at?.floorId))];
    expect(stepFloors).toEqual(["uni-l3", "uni-l2", "uni-l1", "uni-m", "uni-g"]);
  });

  it("takes people who can't use stairs to a Bomba lift, then from the ground floor to the field", () => {
    const assisted = findEvacuationRoute("uni-l3", "meeting-1", { needsAssistance: true })!;
    expect([...new Set(assisted.path.map((p) => p.floorId))]).toEqual(["uni-l3", "uni-g"]);
    const waitAt = assisted.steps.findIndex((s) => s.wait);
    expect(assisted.steps[waitAt + 1].text).toContain("Leave the east Bomba lift with your helper");
    expect(assisted.steps.at(-1)!.text).toContain("assembly point on the field");
  });

  it("stops at a staircase landing when no Bomba lift is usable", () => {
    const assisted = findEvacuationRoute("uni-l3", "meeting-1", { needsAssistance: true, blockedStairIds: ["bomba-w", "bomba-e"] })!;
    expect(new Set(assisted.path.map((p) => p.floorId))).toEqual(new Set(["uni-l3"]));
  });
});

describe("remainingPath (the arrow trail)", () => {
  const route = findEvacuationRoute("uni-l3", "meeting-1")!;

  it("is the whole route at the start", () => {
    expect(remainingPath(route.path, route.path[0])).toEqual(route.path);
  });

  it("drops everything behind each checkpoint", () => {
    let previous = route.path.length + 1;
    for (const step of route.steps) {
      const left = remainingPath(route.path, step.at!);
      expect(left.length).toBeLessThanOrEqual(previous);
      expect(left[0]).toMatchObject(step.at!);
      previous = left.length;
    }
    expect(remainingPath(route.path, route.steps.at(-1)!.at!)).toHaveLength(1);
  });

  it("leaves no arrows on the floors already walked down", () => {
    const onMezzanine = route.steps.find((s) => s.at?.floorId === "uni-m")!.at!;
    expect(remainingPath(route.path, onMezzanine).map((p) => p.floorId)).not.toContain("uni-l3");
  });

  it("starts part-way along a leg when the person is between two corners", () => {
    const [a, b] = route.path;
    const midway = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, floorId: a.floorId };
    expect(remainingPath(route.path, midway)).toEqual([midway, ...route.path.slice(1)]);
  });
});

describe("turnBetween (y axis points down)", () => {
  it("knows left from right", () => {
    expect(turnBetween({ x: 0, y: 1 }, { x: -1, y: 0 })).toBe("right"); // facing south, go west
    expect(turnBetween({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe("left"); // facing south, go east
    expect(turnBetween({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe("straight");
    expect(turnBetween({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe("back");
  });
});

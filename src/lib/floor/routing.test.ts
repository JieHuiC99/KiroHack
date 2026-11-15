import { describe, expect, it } from "vitest";
import { findEvacuationRoute, floors, ground, level3 } from "./building";
import { buildGraph, findRoute, selectableRooms, staircases, turnBetween } from "./routing";

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
    expect(Object.keys(ground.groundExits!).sort()).toEqual(ids);
  });

  it("has unique room ids apart from the staircases", () => {
    const ids = floors.flatMap((f) => f.rooms.filter((r) => r.kind !== "stairs").map((r) => r.id));
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

  it("tells people who can't use stairs to wait on the landing", () => {
    const last = findRoute(level3, "uc-3-3", { needsAssistance: true })!.steps.at(-1)!;
    expect(last.text).toContain("wait on the landing of the south-west staircase");
    expect(last.text).toContain("Do not use the lift");
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

  it("stops at the landing for people who can't use stairs", () => {
    const assisted = findEvacuationRoute("uni-l3", "meeting-1", { needsAssistance: true })!;
    expect(new Set(assisted.path.map((p) => p.floorId))).toEqual(new Set(["uni-l3"]));
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

import { findEvacuationRoute, floors, getFloor, ground } from "./building";
import { centre, pathLength, turnBetween } from "./routing";
import type { EvacuationRoute, Floor, Point, Room, Turn } from "./types";

// Short, numbered directions for the "Your way out" screen, derived from the same route the map draws.

export type ShortStep = {
  text: string;
  floorId: string;
  kind: "start" | "walk" | "turn" | "stairs" | "arrive";
};

export type WayOut = {
  route: EvacuationRoute;
  floor: Floor;
  room: Room;
  /** Where the route ends on the starting floor (the staircase). */
  exitName: string;
  destination: string;
  /** Walking only: the stairs are counted separately. */
  walkMetres: number;
  floorsDown: number;
  steps: ShortStep[];
};

/** The practice route shown on /route: the README demo room. Sample data, not a verified evacuation plan. */
export const PRACTICE_START = { floorId: "uni-l3", roomId: "uc-3-3" } as const;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const heading = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y });
const turnWord = (t: Turn) => (t === "straight" ? "go straight on" : t === "back" ? "turn around" : `turn ${t}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One "Walk N m, then turn" line per leg; the last leg names where it ends. */
function legs(floor: Floor, points: Point[], ending: string, kind: ShortStep["kind"] = "walk"): ShortStep[] {
  const steps: ShortStep[] = [];
  for (let i = 1; i < points.length; i++) {
    const metres = Math.max(1, Math.round(dist(points[i - 1], points[i]) * floor.metresPerUnit));
    const isLast = i === points.length - 1;
    const text = isLast
      ? `Walk ${metres} m ${ending}.`
      : `Walk ${metres} m, then ${turnWord(turnBetween(heading(points[i - 1], points[i]), heading(points[i], points[i + 1])))}.`;
    steps.push({ text, floorId: floor.id, kind: isLast ? kind : "turn" });
  }
  return steps;
}

export function wayOut(floorId: string = PRACTICE_START.floorId, roomId: string = PRACTICE_START.roomId): WayOut | null {
  const floor = getFloor(floorId);
  const room = floor?.rooms.find((r) => r.id === roomId);
  const route = floor && findEvacuationRoute(floorId, roomId);
  if (!floor || !room?.door || !route) return null;

  const exitName = route.stairName;
  const exit = ground.groundExits?.[route.stairId] ?? [];
  const points = route.points;
  const first = points.length > 1 ? turnBetween(heading(centre(room), room.door), heading(points[0], points[1])) : "straight";

  const steps: ShortStep[] = [
    { text: `Leave ${room.name} and ${turnWord(first)}.`, floorId: floor.id, kind: "start" },
    ...legs(floor, points, `to the ${lower(exitName)} (exit)`),
  ];
  // Every floor below counts, the mezzanine too: that is how many flights people walk down.
  const flights = floors.indexOf(floor);
  if (flights > 0 && exit.length > 0) {
    steps.push({
      text: `Take the stairs down ${flights} ${flights === 1 ? "flight" : "flights"} to Ground. Don't use the lift.`,
      floorId: floor.id,
      kind: "stairs",
    });
    const outside = legs(ground, exit, "out to the assembly point on the field", "arrive");
    if (outside[0]) outside[0] = { ...outside[0], text: `Leave the stairs on Ground. ${outside[0].text}` };
    steps.push(...outside);
  }

  return {
    route,
    floor,
    room,
    exitName,
    destination: exit.length > 0 ? "Assembly point, field" : exitName,
    walkMetres: Math.round(pathLength(points) * floor.metresPerUnit + pathLength(exit) * ground.metresPerUnit),
    floorsDown: exit.length > 0 ? flights : 0,
    steps,
  };
}

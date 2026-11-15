import type { Floor, Point, Room, Route, RouteStep, Turn } from "./types";

// Pure functions: no React, no DB. Used by the phone (steps), the 3D map (route line)
// and the server (waiting point for a help request), and unit-tested in routing.test.ts.

const key = (p: Point) => `${p.x},${p.y}`;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const centre = (r: Room): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function pathLength(points: Point[]) {
  return points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0);
}

/** "South-west staircase" → "the south-west staircase", for use inside a sentence. */
export function theStair(name: string) {
  return `the ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function isOnSegment(p: Point, a: Point, b: Point) {
  return Math.abs(dist(a, p) + dist(p, b) - dist(a, b)) < 0.01;
}

type Graph = Map<string, { point: Point; edges: Map<string, number> }>;

/** Corridor centre lines + every door/junction that sits on them → a walkable graph. */
export function buildGraph(floor: Floor): Graph {
  const graph: Graph = new Map();
  const node = (p: Point) => {
    if (!graph.has(key(p))) graph.set(key(p), { point: p, edges: new Map() });
    return graph.get(key(p))!;
  };

  const doors = floor.rooms.flatMap((r) => (r.door ? [r.door] : []));
  const ends = floor.walkways.flatMap((w) => [w.from, w.to]);

  for (const { from, to } of floor.walkways) {
    const onLine = [...doors, ...ends].filter((p) => isOnSegment(p, from, to));
    const unique = [...new Map(onLine.map((p) => [key(p), p])).values()];
    unique.sort((a, b) => dist(from, a) - dist(from, b));
    for (let i = 1; i < unique.length; i++) {
      const a = unique[i - 1];
      const b = unique[i];
      node(a).edges.set(key(b), dist(a, b));
      node(b).edges.set(key(a), dist(a, b));
    }
  }
  return graph;
}

/** Dijkstra from one door. The graph is tiny, so a plain array scan is fine. */
function shortestPaths(graph: Graph, start: Point) {
  const cost = new Map<string, number>([[key(start), 0]]);
  const previous = new Map<string, string>();
  const todo = new Set(graph.keys());

  while (todo.size > 0) {
    let current: string | undefined;
    for (const k of todo) {
      if (cost.has(k) && (current === undefined || cost.get(k)! < cost.get(current)!)) current = k;
    }
    if (current === undefined) break;
    todo.delete(current);
    for (const [next, length] of graph.get(current)!.edges) {
      const candidate = cost.get(current)! + length;
      if (candidate < (cost.get(next) ?? Infinity)) {
        cost.set(next, candidate);
        previous.set(next, current);
      }
    }
  }
  return { cost, previous };
}

/** Drop points that don't change direction, so "walk 3 m, walk 4 m" becomes "walk 7 m". */
function mergeStraightRuns(points: Point[]): Point[] {
  return points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return true;
    const a = points[i - 1];
    const b = points[i + 1];
    const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
    return Math.abs(cross) > 0.01;
  });
}

/** Which way to turn to go from heading `from` to heading `to`. y grows downwards (screen axes). */
export function turnBetween(from: Point, to: Point): Turn {
  const cross = from.x * to.y - from.y * to.x;
  const dot = from.x * to.x + from.y * to.y;
  const angle = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (Math.abs(angle) < 30) return "straight";
  if (Math.abs(angle) > 150) return "back";
  return angle > 0 ? "right" : "left";
}

const heading = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y });

function turnText(turn: Turn) {
  if (turn === "straight") return "Keep going straight.";
  if (turn === "back") return "Turn around.";
  return `Turn ${turn}.`;
}

function sideText(turn: Turn) {
  if (turn === "straight") return "straight ahead";
  if (turn === "back") return "behind you";
  return `on your ${turn}`;
}

/** One "walk N metres, then turn" step per leg of a path. */
export function walkingSteps(floor: Floor, points: Point[], phase: RouteStep["phase"], surface = "along the corridor"): RouteStep[] {
  const steps: RouteStep[] = [];
  for (let i = 1; i < points.length; i++) {
    const metres = Math.max(1, Math.round(dist(points[i - 1], points[i]) * floor.metresPerUnit));
    const walk = `Walk about ${metres} metres ${surface}.`;
    const base = { arrow: "straight" as const, at: { ...points[i - 1], floorId: floor.id }, phase };
    if (i < points.length - 1) {
      const turn = turnBetween(heading(points[i - 1], points[i]), heading(points[i], points[i + 1]));
      steps.push({ ...base, text: `${walk} Then ${turnText(turn).toLowerCase()}`, cue: turn });
    } else {
      steps.push({ ...base, text: walk, cue: "straight" });
    }
  }
  return steps;
}

function describe(floor: Floor, room: Room, stair: Room, points: Point[], needsAssistance: boolean): RouteStep[] {
  const at = (p: Point) => ({ ...p, floorId: floor.id });
  const last = points[points.length - 1];
  const steps: RouteStep[] = [];

  if (points.length < 2) {
    steps.push({ text: `Leave ${room.name} through the door. The staircase is right outside.`, cue: "start", at: at(points[0]), phase: "floor" });
  } else {
    // Leaving the room you face away from it, across the corridor.
    const first = turnBetween(heading(centre(room), room.door!), heading(points[0], points[1]));
    steps.push({ text: `Leave ${room.name} through the door. ${turnText(first)}`, cue: "start", arrow: first, at: at(points[0]), phase: "floor" });
  }

  steps.push(...walkingSteps(floor, points, "floor"));

  const facing = points.length < 2 ? heading(centre(room), room.door!) : heading(points[points.length - 2], last);
  const side = turnBetween(facing, heading(last, centre(stair)));
  steps.push({ text: `${stair.name} is ${sideText(side)}. Find the fire door.`, cue: side, arrow: side, at: at(last), phase: "floor" });

  steps.push(
    needsAssistance
      ? {
          text: `Go through the fire door and wait on the landing of ${theStair(stair.name)}. Do not use the lift. Stay there until your helper arrives.`,
          cue: "arrive",
          at: at(last),
          phase: "floor",
        }
      : {
          text: `Go through the fire door. Hold the handrail and walk down ${floor.level} floors to the ground floor. Then follow the marshals to ${floor.assemblyPoint}.`,
          cue: "arrive",
          at: at(last),
          phase: "stairs",
        },
  );
  return steps;
}

export type RouteOptions = {
  /** Staircases confirmed unusable by the emergency team. */
  blockedStairIds?: string[];
  /** True for people who can't use stairs: the route ends at the staircase landing. */
  needsAssistance?: boolean;
  /** Extra walk after each staircase (stair id → metres), so the choice counts the whole journey. */
  exitMetres?: Record<string, number>;
};

/** Shortest walk from a room to the best usable staircase on the same floor, or null if there isn't one. */
export function findRoute(floor: Floor, roomId: string, options: RouteOptions = {}): Route | null {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room?.door) return null;

  const graph = buildGraph(floor);
  const { cost, previous } = shortestPaths(graph, room.door);
  const blocked = new Set(options.blockedStairIds ?? []);
  const total = (stair: Room) => cost.get(key(stair.door!))! * floor.metresPerUnit + (options.exitMetres?.[stair.id] ?? 0);

  const stair = floor.rooms
    .filter((r) => r.kind === "stairs" && r.door && !blocked.has(r.id) && cost.has(key(r.door)))
    .sort((a, b) => total(a) - total(b))[0];
  if (!stair) return null;

  const path: Point[] = [];
  for (let k: string | undefined = key(stair.door!); k; k = previous.get(k)) {
    path.unshift(graph.get(k)!.point);
  }
  const points = mergeStraightRuns(path);

  return {
    fromRoomId: room.id,
    stairId: stair.id,
    stairName: stair.name,
    points,
    metres: Math.round(cost.get(key(stair.door!))! * floor.metresPerUnit),
    steps: describe(floor, room, stair, points, options.needsAssistance ?? false),
  };
}

export function selectableRooms(floor: Floor): Room[] {
  return floor.rooms.filter((r) => r.kind !== "stairs" && r.door);
}

export function staircases(floor: Floor): Room[] {
  return floor.rooms.filter((r) => r.kind === "stairs");
}

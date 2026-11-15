import { level3 } from "./level3";
import { ground, level1, level2, mezzanine } from "./lower-floors";
import { centre, findRoute, pathLength, theStair, walkingSteps, type RouteOptions } from "./routing";
import type { EvacuationRoute, Floor, Point, RoutePoint, RouteStep } from "./types";

/** Bottom to top. The order is also the stacking order in the 3D model. */
export const floors: Floor[] = [ground, mezzanine, level1, level2, level3];
export { ground, level3 };

/** Floors people can currently pick a room on (the ones with doors and walkways). */
export const routableFloors = floors.filter((f) => f.walkways.length > 0);

export function getFloor(id: string): Floor | undefined {
  return floors.find((f) => f.id === id);
}

const METRES_PER_BUILDING_UNIT = 0.154;
const BUILDING_CENTRE = { x: 500, y: 330 };

/** A point on any floor → metres east (x) and south (z) of the middle of the building. */
export function toMetres(floor: Floor, p: Point) {
  const { scale, dx, dy } = floor.transform;
  return {
    x: (p.x * scale + dx - BUILDING_CENTRE.x) * METRES_PER_BUILDING_UNIT,
    z: (p.y * scale + dy - BUILDING_CENTRE.y) * METRES_PER_BUILDING_UNIT,
  };
}

/** A length in a floor's own units → metres in the model. */
export function toMetresLength(floor: Floor, length: number) {
  return length * floor.transform.scale * METRES_PER_BUILDING_UNIT;
}

/**
 * Room → best staircase → down the stairs → across the ground floor → assembly point.
 * People who can't use stairs go to a Bomba lift, wait there for a helper, ride down together and
 * then cross the ground floor. With no usable Bomba lift they get the same-floor route to a landing only.
 */
export function findEvacuationRoute(floorId: string, roomId: string, options: RouteOptions = {}): EvacuationRoute | null {
  const floor = getFloor(floorId);
  if (!floor) return null;
  const on = (f: Floor, points: Point[]): RoutePoint[] => points.map((p) => ({ ...p, floorId: f.id }));
  const exits = ground.groundExits ?? {};

  if (options.needsAssistance) {
    const route = findRoute(floor, roomId, options);
    if (!route) return null;
    const liftExit = route.exitKind === "bombaLift" ? exits[route.stairId] : undefined;
    if (!liftExit || floor === ground) return { ...route, path: on(floor, route.points) };
    return {
      ...route,
      path: [...on(floor, route.points), ...on(ground, liftExit)],
      steps: [
        ...route.steps,
        {
          text: `Ground floor. Leave ${theStair(route.stairName)} with your helper and follow the arrows outside.`,
          cue: "start",
          at: { ...liftExit[0], floorId: ground.id },
          phase: "ground",
        },
        ...walkingSteps(ground, liftExit, "ground", "following the arrows"),
        {
          text: `You have reached ${ground.assemblyPoint}. Stay here until the all clear.`,
          cue: "arrive",
          at: { ...liftExit[liftExit.length - 1], floorId: ground.id },
          phase: "ground",
        },
      ],
    };
  }

  const exitMetres = Object.fromEntries(Object.entries(exits).map(([id, points]) => [id, pathLength(points) * ground.metresPerUnit]));
  const route = findRoute(floor, roomId, { ...options, exitMetres });
  if (!route) return null;
  const exit = exits[route.stairId];
  if (!exit) return { ...route, path: on(floor, route.points) };

  // Down the shaft: the same staircase on every floor between here and the ground.
  const index = floors.indexOf(floor);
  const shaft = floors
    .slice(1, index + 1)
    .reverse()
    .flatMap((f) => {
      const stair = f.rooms.find((r) => r.id === route.stairId);
      return stair ? on(f, [centre(stair)]) : [];
    });

  // One step per floor on the way down, so the map can show a single floor at a time.
  const stairDoor = { ...route.points[route.points.length - 1], floorId: floor.id };
  const below = floors.slice(0, index).reverse(); // floors under this one, top first, ending with the ground floor
  const floorsLeft = (count: number) => `${count} more ${count === 1 ? "floor" : "floors"}`;
  const descend: RouteStep[] =
    index > 0
      ? [
          {
            text: `Go through the fire door of ${theStair(route.stairName)}. Do not use the lift. Hold the handrail and walk down one floor to ${below[0].label === "Ground" ? "the ground floor" : below[0].label}.`,
            cue: "straight",
            at: stairDoor,
            phase: "stairs",
          },
          ...below.slice(0, -1).map((f, i): RouteStep => {
            const stair = f.rooms.find((r) => r.id === route.stairId);
            return {
              text: `${f.label}. Stay in the staircase and keep walking down, ${floorsLeft(below.length - 1 - i)} to the ground floor.`,
              cue: "straight",
              at: { ...(stair ? centre(stair) : exit[0]), floorId: f.id },
              phase: "stairs",
            };
          }),
        ]
      : [];
  const end = { ...exit[exit.length - 1], floorId: ground.id };

  return {
    ...route,
    path: [...on(floor, route.points), ...shaft, ...on(ground, exit)],
    steps: [
      ...route.steps.slice(0, -1),
      ...descend,
      { text: "Ground floor. Leave the staircase and follow the arrows outside.", cue: "start", at: { ...exit[0], floorId: ground.id }, phase: "ground" },
      ...walkingSteps(ground, exit, "ground", "following the arrows"),
      { text: `You have reached ${ground.assemblyPoint}. Stay here until the all clear.`, cue: "arrive", at: end, phase: "ground" },
    ],
  };
}

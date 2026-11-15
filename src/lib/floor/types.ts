export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** A point on a particular floor (routes cross floors). */
export type RoutePoint = Point & { floorId: string };

/**
 * `stairs` are the emergency staircases (green on the posted fire plans): the way out for everyone who can walk.
 * `bombaLift` is the firefighters' lift (red cross on the plans): the way out for people who can't use stairs,
 * always with a helper or the fire crew. `lift` is an ordinary passenger lift: never used in a fire.
 */
export type RoomKind = "room" | "office" | "toilet" | "stairs" | "bombaLift" | "lift";

export type Room = Rect & {
  id: string;
  /** Empty for blocks that are drawn but have no known name. */
  name: string;
  kind: RoomKind;
  /** Where the room's door meets a corridor centre line. Rooms without one can't be routed. */
  door?: Point;
};

export type Floor = {
  id: string;
  building: string;
  /** 0 = ground. Also the number of floors to walk down. */
  level: number;
  label: string;
  /**
   * Each floor was traced from its own screenshot, so each has its own pixel grid.
   * `transform` lines them up: building = local * scale + (dx, dy). It was worked out by
   * matching the toilet blocks and the four corner staircases, which sit above each other.
   */
  transform: { scale: number; dx: number; dy: number };
  /** Metres per local unit. */
  metresPerUnit: number;
  assemblyPoint: string;
  rooms: Room[];
  corridors: Rect[];
  walkways: { from: Point; to: Point }[];
  /** Ground floor only: the assembly field. */
  field?: Rect;
  /** Ground floor only: for each staircase and Bomba lift id, the walk from where it comes out to the assembly point. */
  groundExits?: Record<string, Point[]>;
};

export type Turn = "left" | "right" | "straight" | "back";

export type RouteStep = {
  text: string;
  /** Drives the vibration pattern on the phone. */
  cue: Turn | "start" | "arrive";
  /** Which way the on-screen arrow points for this step (none when there is nowhere to walk). */
  arrow?: Turn;
  /** Where the person is while this step is on screen. */
  at?: RoutePoint;
  /** Part of the journey: decides what the 3D camera frames. */
  phase?: "floor" | "stairs" | "ground";
  /** The person stays here until a helper arrives. The screen asks before moving on. */
  wait?: boolean;
};

export type Route = {
  fromRoomId: string;
  /** The exit the route leads to: an emergency staircase, or a Bomba lift for people who can't use stairs. */
  stairId: string;
  stairName: string;
  exitKind: "stairs" | "bombaLift";
  /** Door → … → staircase door on the starting floor, in that floor's units. */
  points: Point[];
  /** Walking distance to the staircase. */
  metres: number;
  steps: RouteStep[];
};

/** A route that carries on down the stairs and across the ground floor to the assembly point. */
export type EvacuationRoute = Route & { path: RoutePoint[] };
